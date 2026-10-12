#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
host_audit.py — أداة توعوية لفحص الهوستات ورصد مؤشرات إساءة استغلال "الوجهات المفروضة"
(Zero-Rating Abuse) في شبكات الهاتف المحمول.

الهدف: مساعدة الباحثين ومشغّلي الاتصالات والمواطنين على:
  1. رصد الخوادم الوسيطة المفتوحة (Open Proxies) التي تُستخدم كمخارج لنفق "النت المجاني".
  2. رصد التسامح مع تضليل SNI / رأس Host (Host Fronting) الذي تعتمد عليه خدع العبور.
  3. جمع بصمة المسار (رؤوس الاستجابة، الشهادات، البوابة) للمقارنة بين وجهة مفروضة وأخرى محسوبة.
  4. إنتاج تقرير توعوي يشرح كل مؤشر وعلاقته بخداع "النت المجاني" المدفوع.

هذا المشروع أداتي دفاعية/توعوية. الاستخدام غير المصرح به لشبكات الآخرين أو تجاوز
أنظمة الفوترة مخالف لشروط الخدمة وقد يعرض صاحبه للمساءلة النظامية.
لا تُنتج الأداة أي حمولات استغلال أو إعدادات تجاوز جاهزة.

الاستخدام:
  python3 host_audit.py example.com google.com
  python3 host_audit.py --file hosts.sample.txt --report report.md --json report.json
  python3 host_audit.py api.github.com --safe        # فحص سلبي فقط (بدون اختبارات البروكسي/التضليل)
  python3 host_audit.py --selftest                   # اختبار داخلي بدون شبكة

مكتبة قياسية فقط (Python 3.8+). لا حاجة لأي تبعيات خارجية.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import re
import socket
import ssl
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

__version__ = "1.0.0"
TOOL_NAME = "host_audit.py"

# ───────────────────────── ثوابت ونصوص عربية ─────────────────────────

LEGAL_BANNER_AR = """
════════════════════════════════════════════════════════════════════
  ⚖️  تنويه قانوني — أداة توعوية/دفاعية لفحص الهوستات
════════════════════════════════════════════════════════════════════
• استخدم هذه الأداة فقط على الشبكات والهوستات المصرّح لك بفحصها
  (شبكتك الخاصة، مختبرك، أو بتكليف رسمي من مشغّل الخدمة).
• رصد الثغرات بهدف إساءة استخدام الوجهات المفروضة ("النت المجاني")
  والتهرب من الفوترة مخالف لشروط الخدمة، وقد يُعدّ استخداماً غير
  مشروع للشبكة وفق نظام مكافحة الجرائم المعلوماتية السعودي
  (المرسوم الملكي م/17) ونظائره في بقية الدول.
• هذه الأداة لا تُنتج إعدادات تجاوز أو نقوب جاهزة؛ مهمتها الكشف
  والتوثيق والتوعية وإبلاغ المشغّلين لإصلاح الإعدادات الخاطئة.
════════════════════════════════════════════════════════════════════
"""

SEVERITY_AR = {
    "CRITICAL": "🔴 حرج",
    "WARNING": "🟠 تنبيه",
    "INFO": "🔵 معلومة",
    "OK": "🟢 سليم",
}

PORTAL_KEYWORDS = (
    "login", "signin", "portal", "captive", "hotspot", "gateway",
    "wifi", "welcome", "authenticate", "signup", "billing", "paywall",
)

PROXY_HEADERS = (
    "via", "x-cache", "x-cache-hits", "x-squid-error", "x-forwarded-for",
    "x-forwarded-host", "x-forwarded-proto", "forwarded", "proxy-agent",
    "x-proxy-id", "x-bluecoat-via", "x-mitmproxy", "age", "x-varnish",
    "x-amz-cf-id", "cf-ray", "x-served-by", "x-turbo-charged-by",
)

CONNECT_PROBE_TARGET = "www.example.com"
CONNECT_PROBE_PORT = 443
FRONT_PROBE_HOST = "host-audit-front-probe.invalid"


# ───────────────────────── نماذج البيانات ─────────────────────────

@dataclass
class Finding:
    severity: str          # CRITICAL | WARNING | INFO | OK
    code: str              # رمز المؤشر بالإنجليزية للتحليل الآلي
    title_ar: str
    detail_ar: str


@dataclass
class HostResult:
    host: str
    started_at: str = ""
    duration_ms: int = 0
    ips: List[str] = field(default_factory=list)
    dns_ms: Optional[int] = None
    tcp: Dict[str, dict] = field(default_factory=dict)      # {"443": {...}, "80": {...}}
    tls: Dict[str, dict] = field(default_factory=dict)      # "443": شهادة/بروتوكول
    http: Dict[str, dict] = field(default_factory=dict)     # "https://" | "http://"
    tests: Dict[str, dict] = field(default_factory=dict)    # اختبارات البروكسي/التضليل
    findings: List[Finding] = field(default_factory=list)
    error: str = ""

    @property
    def worst(self) -> str:
        order = {"CRITICAL": 3, "WARNING": 2, "INFO": 1, "OK": 0}
        if not self.findings:
            return "OK"
        return max((f.severity for f in self.findings), key=lambda s: order[s])


# ───────────────────────── عمليات الشبكة الأساسية ─────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _idna(host: str) -> str:
    try:
        return host.encode("idna").decode("ascii")
    except Exception:
        return host


def resolve_host(host: str, timeout: float) -> Tuple[List[str], Optional[int]]:
    """حلّ الاسم إلى عناوين IP مع قياس الزمن (بالمللي ثانية)."""
    t0 = time.monotonic()
    try:
        socket.setdefaulttimeout(timeout)
        infos = socket.getaddrinfo(_idna(host), None, proto=socket.IPPROTO_TCP)
        ips = sorted({i[4][0] for i in infos})
        return ips, int((time.monotonic() - t0) * 1000)
    except socket.gaierror as e:
        raise RuntimeError(f"فشل حلّ الاسم (DNS): {e}") from e


def tcp_probe(ip: str, port: int, timeout: float, host_for_sni: str = "") -> dict:
    """فتح اتصال TCP وقياس الزمن."""
    t0 = time.monotonic()
    try:
        family = socket.AF_INET6 if ":" in ip else socket.AF_INET
        with socket.create_connection((ip, port), timeout=timeout) as s:
            latency = int((time.monotonic() - t0) * 1000)
            return {"open": True, "latency_ms": latency, "family": "IPv6" if family == socket.AF_INET6 else "IPv4"}
    except Exception as e:
        return {"open": False, "error": str(e)[:160], "latency_ms": None}


def _tls_connect(ip: str, port: int, host: str, timeout: float,
                 sni: Optional[str] = None, alpn: Optional[List[str]] = None):
    """فتح اتصال TLS. يعيد (socket, ssl_object)."""
    raw = socket.create_connection((ip, port), timeout=timeout)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE  # نريد بصمة حتى لو كانت الشهادة غير موثوقة
    if alpn:
        try:
            ctx.set_alpn_protocols(alpn)
        except NotImplementedError:
            pass
    server_hostname = sni if sni is not None else host
    tls = ctx.wrap_socket(raw, server_hostname=server_hostname or None)
    return raw, tls


def _decode_cert_der(der: bytes) -> dict:
    """
    تفكيك شهادة DER إلى الحقول الأساسية (Subject/Issuer/Validity/SAN)
    باستخدام المكتبة القياسية فقط (ssl._ssl._test_decode_cert) مع بديل آمن.
    """
    import hashlib
    import os
    import tempfile

    out: dict = {"sha256_32": hashlib.sha256(der).hexdigest()[:32] if der else ""}
    if not der:
        return out
    path = None
    try:
        pem = ssl.DER_cert_to_PEM_cert(der)
        with tempfile.NamedTemporaryFile("w", suffix=".pem", delete=False,
                                         encoding="ascii") as tf:
            tf.write(pem)
            path = tf.name
        decoded = ssl._ssl._test_decode_cert(path)  # type: ignore[attr-defined]
    except Exception:
        decoded = {}
    finally:
        if path:
            try:
                os.unlink(path)
            except OSError:
                pass

    subject_cn, issuer_org, not_after, san_count = "", "", "", 0
    if isinstance(decoded, dict) and decoded:
        for tup in decoded.get("subject") or ():
            for k, v in tup:
                if k == "commonName":
                    subject_cn = v
        for tup in decoded.get("issuer") or ():
            for k, v in tup:
                if k == "organizationName" and not issuer_org:
                    issuer_org = v
        not_after = decoded.get("notAfter", "") or ""
        san_count = len(decoded.get("subjectAltName", ()) or ())
    out.update({
        "cert_subject_cn": subject_cn,
        "cert_issuer_org": issuer_org,
        "cert_not_after": not_after,
        "cert_san_count": san_count,
    })
    return out


def tls_probe(ip: str, port: int, host: str, timeout: float) -> dict:
    """مصافحة TLS واستخراج بصمة الشهادة والبروتوكول."""
    try:
        raw, tls = _tls_connect(ip, port, host, timeout, alpn=["h2", "http/1.1"])
        try:
            cert = tls.getpeercert(binary_form=True) or b""
            fields = _decode_cert_der(cert)
            return {
                "ok": True,
                "protocol": tls.version() or "",
                "cipher": (tls.cipher() or ("", "", 0))[0],
                "alpn": tls.selected_alpn_protocol() or "",
                "cert_sha256_32": fields.get("sha256_32", ""),
                "cert_subject_cn": fields.get("cert_subject_cn") or host,
                "cert_issuer_org": fields.get("cert_issuer_org", ""),
                "cert_not_after": fields.get("cert_not_after", ""),
                "cert_san_count": fields.get("cert_san_count", 0),
            }
            return {
                "ok": True,
                "protocol": tls.version() or "",
                "cipher": (tls.cipher() or ("", "", 0))[0],
                "alpn": tls.selected_alpn_protocol() or "",
                "cert_sha256_32": fp,
                "cert_subject_cn": subject_cn,
                "cert_issuer_org": issuer,
                "cert_not_after": not_after,
                "cert_san_count": san_count,
            }
        finally:
            try:
                tls.close()
            except Exception:
                pass
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


def http_probe(ip: str, port: int, scheme: str, host: str, timeout: float,
               host_header: Optional[str] = None, path: str = "/",
               method: str = "GET", extra_request: str = "") -> dict:
    """طلب HTTP/1.1 يدوي (بدون متابعة التحويل) لالتقاط رؤوس الاستجابة كما هي."""
    result: dict = {"ok": False}
    try:
        if scheme == "https":
            raw, sock = _tls_connect(ip, port, host, timeout)
        else:
            sock = socket.create_connection((ip, port), timeout=timeout)
        try:
            hh = host_header if host_header is not None else host
            req = (
                f"{method} {path} HTTP/1.1\r\n"
                f"Host: {hh}\r\n"
                f"User-Agent: host-audit/{__version__} (awareness scanner; contact: your-org)\r\n"
                f"Accept: */*\r\n"
                f"Connection: close\r\n"
            )
            if extra_request:
                req += extra_request
            req += "\r\n"
            sock.sendall(req.encode("ascii", errors="ignore"))
            chunks: List[bytes] = []
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                try:
                    data = sock.recv(8192)
                except socket.timeout:
                    break
                if not data:
                    break
                chunks.append(data)
                if sum(len(c) for c in chunks) > 65536:
                    break
            raw_resp = b"".join(chunks)
        finally:
            try:
                sock.close()
            except Exception:
                pass

        head, _, body = raw_resp.partition(b"\r\n\r\n")
        lines = head.decode("latin-1", errors="replace").split("\r\n")
        status_line = lines[0] if lines else ""
        m = re.match(r"HTTP/\d(?:\.\d)?\s+(\d{3})(?:\s+(.*))?", status_line)
        status = int(m.group(1)) if m else 0
        reason = (m.group(2) or "") if m else status_line
        headers: Dict[str, str] = {}
        for line in lines[1:]:
            if ":" in line:
                k, _, v = line.partition(":")
                headers[k.strip().lower()] = v.strip()
        result = {
            "ok": True,
            "status": status,
            "reason": reason[:120],
            "headers": headers,
            "body_snippet": body[:400].decode("utf-8", errors="replace"),
            "status_line": status_line[:160],
        }
        return result
    except Exception as e:
        result["error"] = str(e)[:200]
        return result


def open_proxy_test(ip: str, port: int, scheme: str, host: str, timeout: float) -> dict:
    """
    اختبار البروكسي الوسيط المفتوح: إرسال `CONNECT` إلى وجهة خارجية.

    إن ردّ الخادم بـ 2xx أو فتح نفق فعلي ⇒ بروكسي مفتوح (خطورة قصوى)؛
    هذه هي الإعدادات الخاطئة التي يبني عليها بائعو "النت المجاني" أنفاقهم.
    إن ردّ بـ 403/405/502 ⇒ بروكسي موجود لكنه مقيد (معلومة مفيدة للمشغّل).
    """
    out: dict = {"performed": True, "open": False, "restricted": False,
                 "status": 0, "status_line": "", "note_ar": ""}
    try:
        if scheme == "https":
            raw, sock = _tls_connect(ip, port, host, timeout)
        else:
            sock = socket.create_connection((ip, port), timeout=timeout)
        try:
            req = (
                f"CONNECT {CONNECT_PROBE_TARGET}:{CONNECT_PROBE_PORT} HTTP/1.1\r\n"
                f"Host: {CONNECT_PROBE_TARGET}:{CONNECT_PROBE_PORT}\r\n"
                f"User-Agent: host-audit/{__version__} (awareness scanner)\r\n"
                f"Proxy-Connection: keep-alive\r\n"
                f"\r\n"
            )
            sock.sendall(req.encode("ascii"))
            data = b""
            try:
                data = sock.recv(2048)
            except socket.timeout:
                pass
        finally:
            try:
                sock.close()
            except Exception:
                pass
        text = data.decode("latin-1", errors="replace")
        first = text.split("\r\n", 1)[0] if text else ""
        m = re.match(r"HTTP/\d(?:\.\d)?\s+(\d{3})", first)
        status = int(m.group(1)) if m else 0
        out["status"] = status
        out["status_line"] = first[:160]
        if 200 <= status < 300:
            out["open"] = True
            out["note_ar"] = ("استجاب الخادم لطلب CONNECT بنجاح — أي أنه يعمل كبروكسي وسيط مفتوح. "
                              "هذا بالضبط ما يستخدمه بائعو «النت المجاني» لتوجيه كل مرورهم عبر "
                              "نطاق/خادم «مفروض» ثم إلى أنفاقهم. يجب إغلاق هذه الوظيفة فوراً.")
        elif status in (401, 403, 405, 407, 501, 502, 503):
            out["restricted"] = True
            out["note_ar"] = ("يوجد منطق بروكسي في المسار لكنه رفض التوجيه (رد مقيّد). "
                              "يشير إلى وسيط/كاش مُعدّ للمشاركة أو مسار فوترة خاص — قارن هذه "
                              "البصمة مع وجهة غير مفروضة لرصد مسارات «العدّ المنفصل».")
        else:
            out["note_ar"] = ("لم يستجب لطلب CONNECT كبروكسي (سلوك عادي لخادم ويب).")
        return out
    except Exception as e:
        out["performed"] = False
        out["error"] = str(e)[:200]
        out["note_ar"] = "تعذّر إجراء اختبار البروكسي."
        return out


def fronting_tolerance_test(ip: str, port: int, host: str, timeout: float) -> dict:
    """
    اختبار التسامح مع تضليل Host / SNI (Host Fronting):

    نتصل إلى خادم الهوست نفسه بـ SNI الصحيح، لكن نرسل رأس Host لاسم غير موجود
    (host-audit-front-probe.invalid). إن أعاد الخادم محتوى 200/3xx من الـ vhost
    الافتراضي بدل 421/404/403 ⇒ الخادم «متسامح» مع تبديل رأس Host، وهذه خاصية
    تعتمد عليها خدع تمرير المرور خلف نطاق «مفروض».
    """
    out: dict = {"performed": True, "tolerant": False, "status": 0,
                 "status_line": "", "note_ar": ""}
    try:
        resp = http_probe(ip, port, "https", host, timeout,
                          host_header=FRONT_PROBE_HOST)
        if not resp.get("ok"):
            out["performed"] = False
            out["error"] = resp.get("error", "")
            out["note_ar"] = "تعذّر إجراء اختبار التضليل."
            return out
        status = int(resp.get("status") or 0)
        out["status"] = status
        out["status_line"] = resp.get("status_line", "")
        server = (resp.get("headers") or {}).get("server", "")
        out["server"] = server
        if status in (200, 204, 301, 302, 303, 307, 308):
            out["tolerant"] = True
            out["note_ar"] = (
                "استجاب الخادم لرأس Host مزوّر (اسم غير موجود) بمحتوى/تحويل ناجح — "
                "أي أنه يقبل التضليل (Host-Header Fronting). مشغّلو الشبكات يقعون "
                "بسبب هذه الخاصية في خدع «النت المجاني»؛ يجب فرض مطابقة SNI مع Host "
                "ورفض الطلبات المضلّلة بـ 421/404."
            )
        elif status in (400, 403, 404, 421):
            out["tolerant"] = False
            out["note_ar"] = ("رفض الخادم رأس Host غير المطابق (سلوك صحيح).")
        else:
            out["tolerant"] = False
            out["note_ar"] = (f"ردّ غير حاسم ({status}) — راقبه يدوياً.")
        return out
    except Exception as e:
        out["performed"] = False
        out["error"] = str(e)[:200]
        out["note_ar"] = "تعذّر إجراء اختبار التضليل."
        return out


# ───────────────────────── التحليل وتوليد المؤشرات ─────────────────────────

def analyze_host(host: str, timeout: float, safe_mode: bool) -> HostResult:
    res = HostResult(host=host, started_at=_now_iso())
    t_start = time.monotonic()
    try:
        res.ips, res.dns_ms = resolve_host(host, timeout)
    except Exception as e:
        res.error = str(e)
        res.findings.append(Finding(
            "INFO", "DNS_FAIL", "تعذّر حلّ الاسم",
            f"لم يُحل الاسم {host}: {e}. قد يكون النطاق محجوباً أو غير موجود أو الـ DNS محجوب في الشبكة.",
        ))
        res.duration_ms = int((time.monotonic() - t_start) * 1000)
        return res

    if not res.ips:
        res.findings.append(Finding("INFO", "DNS_EMPTY", "لا توجد عناوين IP", "حلّ الاسم أعاد قائمة فارغة."))
        res.duration_ms = int((time.monotonic() - t_start) * 1000)
        return res

    res.findings.append(Finding(
        "OK", "DNS_OK", "تم حلّ الاسم بنجاح",
        f"العناوين: {', '.join(res.ips[:8])} خلال {res.dns_ms} مللي ثانية.",
    ))

    ip = res.ips[0]
    for port, scheme in ((443, "https"), (80, "http")):
        probe = tcp_probe(ip, port, timeout)
        res.tcp[str(port)] = probe

    # TLS على 443
    if res.tcp.get("443", {}).get("open"):
        tls_info = tls_probe(ip, 443, host, timeout)
        res.tls["443"] = tls_info
        if tls_info.get("ok"):
            res.findings.append(Finding(
                "INFO", "TLS_INFO", "بصمة TLS",
                f"البروتوكول {tls_info.get('protocol')}، الشهادة SHA256={tls_info.get('cert_sha256_32')}…، "
                f"المُصدر: {tls_info.get('cert_issuer_org') or 'غير مقروء'}، ALPN={tls_info.get('alpn') or '—'}. "
                "احتفظ بهذه البصمة؛ اختلافها بين مسارين (مفروض/مدفوع) مؤشر على توجيه مختلف للفوترة.",
            ))
        else:
            res.findings.append(Finding(
                "WARNING", "TLS_FAIL", "فشلت مصافحة TLS",
                f"السبب: {tls_info.get('error', 'غير معروف')} — قد يشير إلى باب وصول (Portal) أو اعتراض للاتصال (MITM).",
            ))

    # HTTP على المنفذين
    for scheme, port in (("https", 443), ("http", 80)):
        if not res.tcp.get(str(port), {}).get("open"):
            continue
        resp = http_probe(ip, port, scheme, host, timeout)
        res.http[f"{scheme}://"] = resp
        if resp.get("ok"):
            status = resp.get("status", 0)
            headers = resp.get("headers") or {}
            location = headers.get("location", "")
            via = headers.get("via", "")
            server = headers.get("server", "")

            # 1) بوابة دخول (Captive Portal)
            blob = (location + " " + resp.get("body_snippet", "")[:300]).lower()
            if status in (301, 302, 303, 307, 308) and any(k in blob for k in PORTAL_KEYWORDS):
                res.findings.append(Finding(
                    "INFO", "CAPTIVE_PORTAL", "تحويل إلى بوابة دخول (Captive Portal)",
                    f"التحويل إلى: {location[:140]}. هذا شائع في الشبكات العامة والمفروضة؛ "
                    "بعض البوابات هي نفسها ما يُستغَل في خدع «الشبكة المجانية».",
                ))

            # 2) وسائط/كاش في المسار
            interesting = {k: v for k, v in headers.items() if k in PROXY_HEADERS}
            if interesting:
                pretty = ", ".join(f"{k}={v[:60]}" for k, v in list(interesting.items())[:6])
                res.findings.append(Finding(
                    "INFO", "PROXY_PATH", "وسائط/كاش ظاهر في مسار الطلب",
                    f"رؤوس المسار: {pretty}. في شبكات الهاتف، اختلاف الوسيط (Via/X-Cache) بين "
                    "وجهة «مفروضة» وأخرى «محسوبة» يكشف مسار فوترة منفصلاً — وهو ما تعتمد عليه "
                    "خدع العبور. سجّل هذه البصمة وقارنها.",
                ))

            if status >= 400:
                res.findings.append(Finding(
                    "INFO", "HTTP_ERROR", f"استجابة HTTP {status}",
                    f"عنوان الاستجابة: {resp.get('reason', '')[:80]} — قد يكون حجوباً أو خادماً مقيداً.",
                ))
        else:
            res.findings.append(Finding(
                "INFO", "HTTP_FAIL", f"تعذّر طلب {scheme}",
                f"السبب: {resp.get('error', 'غير معروف')}.",
            ))

    # اختبارات متقدمة (تتطلب تفاعلاً أعلى — تعطَّل مع --safe)
    if not safe_mode:
        if res.tcp.get("443", {}).get("open"):
            res.tests["fronting_https_443"] = fronting_tolerance_test(ip, 443, host, timeout)
        if res.tcp.get("80", {}).get("open"):
            res.tests["connect_http_80"] = open_proxy_test(ip, 80, "http", host, timeout)
        if res.tcp.get("443", {}).get("open"):
            res.tests["connect_https_443"] = open_proxy_test(ip, 443, "https", host, timeout)

        for key, test in res.tests.items():
            if not test.get("performed"):
                continue
            if test.get("open"):
                res.findings.append(Finding(
                    "CRITICAL", "OPEN_PROXY",
                    "⚠️ بروكسي وسيط مفتوح (Open Forward Proxy) عبر CONNECT",
                    test.get("note_ar", "") + f" (الاختبار: {key}، رد: {test.get('status_line', '')})",
                ))
            elif test.get("tolerant"):
                res.findings.append(Finding(
                    "WARNING", "FRONTING_TOLERANT",
                    "⚠️ تسامح مع تضليل SNI / رأس Host (Host Fronting)",
                    test.get("note_ar", "") + f" (الاختبار: {key}، رد: {test.get('status_line', '')})",
                ))
            elif test.get("restricted"):
                res.findings.append(Finding(
                    "INFO", "RESTRICTED_PROXY", "بروكسي/وسيط مقيّد في المسار",
                    test.get("note_ar", ""),
                ))

    res.duration_ms = int((time.monotonic() - t_start) * 1000)
    return res


# ───────────────────────── التقرير والعرض ─────────────────────────

def render_markdown(results: List[HostResult], safe_mode: bool) -> str:
    now = _now_iso()
    counts = {"CRITICAL": 0, "WARNING": 0, "INFO": 0, "OK": 0}
    for r in results:
        counts[r.worst] = counts.get(r.worst, 0) + 1

    lines: List[str] = []
    lines.append("# تقرير فحص الهوستات — توعية بخدع «النت المجاني»")
    lines.append("")
    lines.append(f"> أُنشئ بواسطة `{TOOL_NAME}` إصدار {__version__} — {now}")
    lines.append(f"> الوضع: {'سلبي (بدون اختبارات تفاعلية)' if safe_mode else 'كامل (يشمل اختبارات البروكسي/التضليل)'}")
    lines.append("")
    lines.append("## ⚖️ تنويه قانوني")
    lines.append("")
    lines.append("> هذه أداة توعوية/دفاعية. الفحص يُجرى فقط على ما تملك تصريح فحصه. "
                 "استغلال النتائج لتجاوز الفوترة أو بناء أنفاق «مجانية» مخالف لشروط الخدمة "
                 "وقد يُعدّ استخداماً غير مشروع للشبكة وفق نظام مكافحة الجرائم المعلوماتية "
                 "(المرسوم الملكي م/17 وتاريخ 8/3/1428هـ) ونظائره. الأداة لا تُنتج حمولات استغلال.")
    lines.append("")
    lines.append("## ملخص النتائج")
    lines.append("")
    lines.append("| التصنيف | العدد |")
    lines.append("|---|---|")
    for sev in ("CRITICAL", "WARNING", "INFO", "OK"):
        lines.append(f"| {SEVERITY_AR[sev]} | {counts.get(sev, 0)} |")
    lines.append("")
    lines.append("| الهوست | الأسوأ | مدة الفحص | أبرز مؤشر |")
    lines.append("|---|---|---|---|")
    for r in results:
        top = next((f for f in r.findings if f.severity == r.worst), None)
        top_txt = top.title_ar if top else ("خطأ: " + r.error[:60] if r.error else "—")
        lines.append(f"| `{r.host}` | {SEVERITY_AR[r.worst]} | {r.duration_ms}ms | {top_txt} |")
    lines.append("")

    lines.append("## 📚 ما علاقة هذا بخدع «النت المجاني»؟ (توعية)")
    lines.append("")
    lines.append("يبيع أشخاص «اشتراكات شهرية» (مثل 20$) لتحويل باقات محددة — ألعاب/سوشيال — "
                 "إلى «إنترنت لكل التطبيقات». الآلية باختصار:")
    lines.append("")
    lines.append("1. **الفوترة بالوجهة**: المشغّل لا يعدّ كل المرور بالمثل؛ بل يُعفي نطاقات/منافذ "
                 "محددة (ألعاب مثل PUBG/Discord، سوشيال مثل سناب/تيك توك).")
    lines.append("2. **تضليل الهوست**: أداة على الهاتف تفتح نفقاً إلى سيرفر البائع، لكنها تضع في "
                 "بداية الاتصال (SNI أو رأس Host) اسم نطاق «مفروض» — فيرى نظام الفوترة مجالاً "
                 "مجانياً ويسمح بالمرور دون عدّ.")
    lines.append("3. **البروكسي المفتوح/التوجيه المعيب**: إن سمح خادم وسيط (أو vhost على نطاق مفروض) "
                 "بتوجيه الطلب إلى سيرفر آخر، صار هو مخرج النفق. **الاختباران الأخطر في هذا "
                 "التقرير (OPEN_PROXY و FRONTING_TOLERANT) يكشفان هاتين الحالتين بالضبط.**")
    lines.append("4. **الخسارة الحقيقية للضحية**: مرورك يمر عبر سيرفر البائع ⇒ يستطيع التنصت "
                 "وتعديل البيانات وسرقة الحسابات؛ والإعدادات تموت كلما أغلق المشغّل الثغرة، "
                 "بينما يبقى الاشتراك الشهري «متجدداً».")
    lines.append("")
    lines.append("لكل مؤشر أدناه شرح مبسّط وأثره في هذه الخدع. التقرير التفصيلي الكامل: "
                 "`docs/free-internet-scams/README.md`.")
    lines.append("")

    for r in results:
        lines.append(f"---")
        lines.append(f"## `{r.host}` — {SEVERITY_AR[r.worst]}")
        lines.append("")
        if r.error:
            lines.append(f"**خطأ:** {r.error}")
            lines.append("")
        if r.ips:
            shown = ", ".join(r.ips[:8]) + (" …" if len(r.ips) > 8 else "")
            lines.append(f"- **العناوين:** {shown} (DNS: {r.dns_ms}ms)")
        for port, info in r.tcp.items():
            state = "مفتوح" if info.get("open") else "مغلق/غير متاح"
            lat = f"، زمن {info.get('latency_ms')}ms" if info.get("latency_ms") is not None else ""
            lines.append(f"- **TCP/{port}:** {state}{lat}")
        if r.tls.get("443", {}).get("ok"):
            t = r.tls["443"]
            lines.append(f"- **TLS:** {t.get('protocol')} / {t.get('cipher')} / ALPN={t.get('alpn') or '—'} / "
                         f"SHA256={t.get('cert_sha256_32')}…")
        for scheme, info in r.http.items():
            if info.get("ok"):
                loc = (info.get("headers") or {}).get("location", "")
                loc_txt = f" → {loc[:80]}" if loc else ""
                lines.append(f"- **HTTP {scheme}:** {info.get('status')}{loc_txt}")
        lines.append("")
        if r.findings:
            lines.append("| الخطورة | المؤشر | الشرح |")
            lines.append("|---|---|---|")
            for f in r.findings:
                detail = f.detail_ar.replace("|", "\\|").replace("\n", " ")
                lines.append(f"| {SEVERITY_AR[f.severity]} | {f.title_ar} | {detail} |")
        else:
            lines.append("_لا مؤشرات._")
        lines.append("")

    lines.append("---")
    lines.append("## ✅ التوصيات")
    lines.append("")
    lines.append("**للأفراد:**")
    lines.append("- لا تشترِ «إعدادات نت مجانية»؛ غالبًا نصب + سرقة بيانات + مخالفة نظامية.")
    lines.append("- إن كنت مشتركاً فعلاً: أوقف النفق، غيّر كلمات المرور، وافحص حساباتك البنكية.")
    lines.append("- استخدم باقات المشغّل الرسمية (أمثلة موثقة: باقة الألعاب/السوشيال 60 ريال).")
    lines.append("")
    lines.append("**للمشغّلين والباحثين:**")
    lines.append("- أغلق وظيفة CONNECT على كل بروكسي/وسيط لا يحتاجها.")
    lines.append("- فرض مطابقة SNI ↔ Host ورفض المضلّل بـ 421/404.")
    lines.append("- راقب أنماط الوسائط (Via/X-Cache) للوجهات المفروضة واحصرها بقوائم IP/ASN صارمة.")
    lines.append("- أرسل بلاغات إساءة الاستخدام لجهات الاختصاص (الهيئة السعودية للاتصالات والفضاء والتقنية).")
    lines.append("")
    lines.append("_تذكير: هذه الأداة للتوعية والدفاع والتوثيق — لا لسرقة الخدمات._")
    return "\n".join(lines)


def to_json(results: List[HostResult], safe_mode: bool) -> dict:
    return {
        "tool": TOOL_NAME,
        "version": __version__,
        "generated_at": _now_iso(),
        "mode": "safe" if safe_mode else "full",
        "disclaimer_ar": "أداة توعوية/دفاعية. لا تُستخدم لتجاوز الفوترة أو إساءة استخدام الشبكات.",
        "hosts": [
            {
                **{k: v for k, v in asdict(r).items() if k != "findings"},
                "worst": r.worst,
                "findings": [asdict(f) for f in r.findings],
            }
            for r in results
        ],
    }


def print_console_summary(results: List[HostResult]) -> None:
    for r in results:
        print(f"\n─── {r.host} ─── {SEVERITY_AR[r.worst]}  ({r.duration_ms}ms)")
        if r.error:
            print(f"   خطأ: {r.error}")
        for f in r.findings:
            if f.severity == "OK" and f.code == "DNS_OK":
                continue
            print(f"   {SEVERITY_AR[f.severity]}  {f.title_ar}")
            if f.detail_ar:
                print(f"        {f.detail_ar[:220]}")
    print("\n" + "═" * 60)
    crit = sum(1 for r in results if r.worst == "CRITICAL")
    warn = sum(1 for r in results if r.worst == "WARNING")
    print(f"الخلاصة: {len(results)} هوست — {crit} حرج، {warn} تنبيه. "
          f"راجع التقرير للتفاصيل والتوعية.")


# ───────────────────────── الاختبار الداخلي ─────────────────────────

def selftest() -> int:
    """اختبار بدون شبكة: يتحقق من سلامة توليد التقرير والنماذج."""
    fake = HostResult(host="demo.example", started_at=_now_iso(), duration_ms=12,
                      ips=["203.0.113.7"], dns_ms=5,
                      tcp={"443": {"open": True, "latency_ms": 9, "family": "IPv4"},
                           "80": {"open": True, "latency_ms": 8, "family": "IPv4"}},
                      findings=[
                          Finding("CRITICAL", "OPEN_PROXY", "بروكسي مفتوح (اختبار)",
                                  "شرح تجريبي لاختبار توليد التقرير."),
                          Finding("WARNING", "FRONTING_TOLERANT", "تسامح مع التضليل (اختبار)", "شرح تجريبي."),
                          Finding("INFO", "PROXY_PATH", "مسار فيه وسيط (اختبار)", "شرح تجريبي."),
                      ])
    md = render_markdown([fake], safe_mode=False)
    js = to_json([fake], safe_mode=False)
    assert "تقرير فحص الهوستات" in md, "فشل توليد التقرير"
    assert js["hosts"][0]["host"] == "demo.example", "فشل توليد JSON"
    assert fake.worst == "CRITICAL", "فشل حساب الخطورة"
    print("✅ selftest OK — التقرير و JSON يعملان بشكل سليم.")
    return 0


# ───────────────────────── الواجهة الرئيسية ─────────────────────────

def main(argv: Optional[List[str]] = None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass

    p = argparse.ArgumentParser(
        prog=TOOL_NAME,
        description="أداة توعوية لفحص الهوستات ورصد مؤشرات إساءة الوجهات المفروضة (Zero-Rating Abuse).",
        epilog="للتوعية الكاملة بخدع «النت المجاني» راجع docs/free-internet-scams/README.md",
    )
    p.add_argument("hosts", nargs="*", help="هوستات لفحصها (مثال: example.com)")
    p.add_argument("-f", "--file", help="ملف يحوي هوستاً واحداً في كل سطر (# للتعليقات)")
    p.add_argument("-t", "--timeout", type=float, default=6.0, help="مهلة الاتصال بالثواني (افتراضي 6)")
    p.add_argument("-w", "--workers", type=int, default=6, help="عدد الفحوصات المتوازية (افتراضي 6)")
    p.add_argument("--safe", action="store_true",
                   help="الوضع السلبي: DNS/TLS/HTTP فقط، بدون اختبارات البروكسي/التضليل")
    p.add_argument("--report", help="مسار حفظ التقرير Markdown")
    p.add_argument("--json", dest="json_out", help="مسار حفظ النتائج JSON")
    p.add_argument("--quiet", action="store_true", help="طباعة ملخص قصير فقط")
    p.add_argument("--no-banner", action="store_true", help="إخفاء البانر القانوني")
    p.add_argument("--selftest", action="store_true", help="اختبار داخلي بدون شبكة")
    p.add_argument("--version", action="version", version=f"{TOOL_NAME} {__version__}")
    args = p.parse_args(argv)

    if args.selftest:
        return selftest()

    hosts: List[str] = list(args.hosts or [])
    if args.file:
        try:
            with open(args.file, "r", encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        hosts.append(line.split()[0])
        except OSError as e:
            print(f"تعذّر قراءة الملف {args.file}: {e}", file=sys.stderr)
            return 2

    # تنظيف وتنحية التكرارات مع الحفاظ على الترتيب
    seen = set()
    clean_hosts: List[str] = []
    for h in hosts:
        h = h.strip().lower().rstrip(".")
        if h and h not in seen:
            seen.add(h)
            clean_hosts.append(h)

    if not clean_hosts:
        p.print_help()
        print("\nمثال: python3 host_audit.py api.github.com --report report.md")
        return 1

    if not args.no_banner:
        print(LEGAL_BANNER_AR)

    print(f"🔎 فحص {len(clean_hosts)} هوست… (الوضع: {'سلبي' if args.safe else 'كامل'})")
    results: List[HostResult] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = {pool.submit(analyze_host, h, args.timeout, args.safe): h for h in clean_hosts}
        for fut in concurrent.futures.as_completed(futures):
            h = futures[fut]
            try:
                results.append(fut.result())
            except Exception as e:
                r = HostResult(host=h, error=str(e))
                r.findings.append(Finding("INFO", "INTERNAL", "خطأ داخلي", str(e)[:200]))
                results.append(r)

    # ترتيب النتائج حسب ترتيب الإدخال ثم الخطورة
    order = {h: i for i, h in enumerate(clean_hosts)}
    results.sort(key=lambda r: order.get(r.host, 999))

    if not args.quiet:
        print_console_summary(results)
    else:
        for r in results:
            print(f"{r.host}: {SEVERITY_AR[r.worst]}")

    md = render_markdown(results, args.safe)
    if args.report:
        with open(args.report, "w", encoding="utf-8") as fh:
            fh.write(md)
        print(f"\n📄 حُفظ التقرير: {args.report}")
    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as fh:
            json.dump(to_json(results, args.safe), fh, ensure_ascii=False, indent=2)
        print(f"📦 حُفظ JSON: {args.json_out}")
    if not args.report and not args.json_out:
        print("\n💡 احفظ التقرير الكامل: أضف --report report.md")

    return 0


if __name__ == "__main__":
    sys.exit(main())
