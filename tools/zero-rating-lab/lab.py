#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
zero-rating-lab — مختبر محاكاة محلي 100% (localhost فقط)
=========================================================

تجربة عملية «تراها بعينيك» لكيفية عمل خدع «النت المجاني» وكيف تُغلق:

  ① بوابة فوترة تحاكي العدّ بالوجهة (تثق في اسم Host — الخطأ الشهير).
  ② «سيرفر البائع» الذي يرى كل مرورك (درس MITM الحقيقي).
  ③ عميل يجرّب التضليل ضد المحاكاة فقط — وترى العدّ ينزل إلى الصفر.
  ④ الوضع الآمن: البوابة ترفض التضليل وترفض CONNECT — والخدعة تموت.

⚖️ كل شيء يشتغل داخل جهازك على 127.0.0.1 — لا يُرسل أي باكت لأي شبكة
حقيقية، ولا يحتوي المختبر على أي هوست حقيقي أو إعداد خدع جاهز.
الأسماء المستخدمة (games.example / social.example / seller.lab) تجريدية.

التشغيل:
    python3 lab.py              # السيناريوهات الأربعة + الخلاصة
    python3 lab.py --serve      # يبقي الخوادم تعمل لتجربة curl يدوياً
"""

from __future__ import annotations

import argparse
import http.client
import select
import socket
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ───────────────────── الإعدادات (كلها محلية) ─────────────────────

GATEWAY_HOST, GATEWAY_PORT = "127.0.0.1", 8080   # بوابة المشغّل (المقياس)
SITES_HOST, SITES_PORT = "127.0.0.1", 8081       # "الإنترنت": مواقع محاكاة
SELLER_HOST, SELLER_PORT = "127.0.0.1", 9090     # "سيرفر البائع"

ZERO_RATED = {"games.example", "social.example"}   # الوجهات المفروضة (محاكاة)
SITE_MAP = {                                       # النطاق → (المضيف, المنفذ)
    "games.example": (SITES_HOST, SITES_PORT),
    "social.example": (SITES_HOST, SITES_PORT),
    "news.example": (SITES_HOST, SITES_PORT),
    "seller.lab": (SELLER_HOST, SELLER_PORT),
}

# وضع البوابة: "vulnerable" (تثق في Host) أو "fixed" (تمسك مطابقة Host↔الوجهة)
MODE = {"name": "vulnerable"}

BILL = {"metered": 0, "zero_rated": 0, "blocked": 0, "events": []}
BILL_LOCK = threading.Lock()


def bill_add(metered: int = 0, zero_rated: int = 0, blocked: int = 0, note: str = "") -> None:
    with BILL_LOCK:
        BILL["metered"] += metered
        BILL["zero_rated"] += zero_rated
        BILL["blocked"] += blocked
        if note:
            BILL["events"].append(note)


def bill_snapshot() -> dict:
    with BILL_LOCK:
        return {k: (v[:] if isinstance(v, list) else v) for k, v in BILL.items()}


# ───────────────────── ① مواقع "الإنترنت" المحاكية ─────────────────────

class SitesHandler(BaseHTTPRequestHandler):
    server_version = "LabSites/1.0"

    def log_message(self, *a):  # إسكات السجل الافتراضي
        pass

    def do_GET(self):
        vhost = (self.headers.get("Host") or "news.example").split(":")[0]
        pages = {
            "games.example": ("🎮 موقع الألعاب (وجهة مفروضة/Zero-Rated)",
                              "هذا الموقع يُعفى من العدّ في باقة الألعاب — وهذه هي «الستارة»."),
            "social.example": ("💬 موقع سوشيال (وجهة مفروضة/Zero-Rated)",
                               "وهو الوجهة المفروضة الثانية في محاكاة باقة السوشال."),
            "news.example": ("📰 موقع أخبار (وجهة محسوبة)",
                             "هذا الموقع يُحتسب من رصيدك كالمعتاد."),
        }
        title, body = pages.get(vhost, ("صفحة افتراضية", "vhost غير معروف في المحاكاة."))
        html = f"""<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>{title}</title></head>
<body style="font-family:sans-serif;max-width:40em;margin:2em auto">
<h1>{title}</h1><p>{body}</p>
<p style="color:#888">zero-rating-lab — محتوى محاكاة محلي (localhost).</p></body></html>"""
        data = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Lab-Vhost", vhost)
        self.end_headers()
        self.wfile.write(data)


# ───────────────────── ③ "سيرفر البائع" — درس الرؤية الكاملة ─────────────────────

SELLER_SEEN: list = []
SELLER_LOCK = threading.Lock()


class SellerHandler(BaseHTTPRequestHandler):
    server_version = "LabSeller/1.0"

    def log_message(self, *a):
        pass

    def do_GET(self):
        with SELLER_LOCK:
            SELLER_SEEN.append({
                "path": self.path,
                "host_header": self.headers.get("Host", ""),
                "cookie": self.headers.get("Cookie", ""),
                "authorization": self.headers.get("Authorization", ""),
                "user_agent": self.headers.get("User-Agent", ""),
            })
        html = """<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>سيرفر البائع</title></head>
<body style="font-family:sans-serif;max-width:40em;margin:2em auto;background:#2b0d0d;color:#f5d6d6">
<h1>💸 أنت الآن داخل "سيرفر بائع النت المجاني"</h1>
<p>في العالم الحقيقي: كل ما تتصفحه (بنكك، حساباتك، صورك) يمرّ من هنا قبل الإنترنت.</p>
<p>صاحب هذا السيرفر يستطيع <b>قراءة</b> ما لا يُشفَّر و<b>تعديل</b> أي شيء، وتسجيل كل زياراتك.</p>
<p style="color:#ffb3b3">هذا هو مفتاح "العرض" الذي يباع لك بـ 20 دولار شهرياً.</p>
</body></html>"""
        data = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


# ───────────────────── ① بوابة الفوترة (المقياس) ─────────────────────

class GatewayHandler(BaseHTTPRequestHandler):
    """
    بروكسي وسيط محاكي يقوم بالعدّ حسب اسم Host (كما تفعل أنظمة فوترة
    مصمّمة بشكل هش). في الوضع "fixed" يُمسك مطابقة Host↔الوجهة ويرفض
    CONNECT، فتختفي الخدعة تماماً.
    """
    server_version = "LabGateway/1.0"

    def log_message(self, *a):
        pass

    # ── عدّ الطلب واتخاذ القرار ──
    def _meter(self, dest_host: str, host_header: str, body_len: int) -> tuple:
        """يرجع (allowed, charge_metered, charge_zero, reason_ar)."""
        host_header = (host_header or "").split(":")[0].lower()
        dest_host = (dest_host or "").lower()
        spoofed = host_header in ZERO_RATED and host_header != dest_host

        if MODE["name"] == "fixed":
            if spoofed:
                return (False, body_len, 0,
                        "تضليل مرصود: Host يدّعي وجهة مفروضة لكن الوجهة الحقيقية مختلفة → 421")
            if host_header in ZERO_RATED:
                return (True, 0, body_len, "وجهة مفروضة مطابقة → لا يُحتسب")
            return (True, body_len, 0, "وجهة محسوبة → يُحتسب")
        # الوضع الضعيف: يثق في Host عمياءً (هنا تحدث الخدعة)
        if host_header in ZERO_RATED:
            return (True, 0, body_len, "البوابة وثقت باسم Host المزوّر → لا يُحتسب (!)")
        return (True, body_len, 0, "وجهة محسوبة → يُحتسب")

    def _forward(self, dest: tuple, method: str, path: str, headers: dict) -> tuple:
        """يحوّل الطلب إلى الوجهة الحقيقية ويعيد (status, headers, body)."""
        conn = http.client.HTTPConnection(dest[0], dest[1], timeout=5)
        try:
            conn.request(method, path, headers=headers)
            resp = conn.getresponse()
            body = resp.read(2_000_000)
            return (resp.status, dict(resp.getheaders()), body)
        except Exception as e:
            return (502, {}, f"LabGateway: تعذّر الوصول للوجهة: {e}".encode())
        finally:
            conn.close()

    def _reply(self, status: int, body: bytes, extra: dict | None = None):
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    # ── GET (نمط البروكسي: عنوان مطلق) ──
    def do_GET(self):
        url = self.path
        parsed = urllib.parse.urlparse(url)
        dest_host = parsed.hostname or ""
        dest = SITE_MAP.get(dest_host)
        host_header = self.headers.get("Host", "")
        if not dest:
            body = "LabGateway: وجهة غير معروفة في المحاكاة (المسموح: *.example / seller.lab)".encode("utf-8")
            self._reply(404, body)
            return

        allowed, ch_m, ch_z, reason = self._meter(dest_host, host_header, 0)
        if not allowed:
            bill_add(metered=ch_m, blocked=1, note=f"🚫 رُفض (مضلَّل): {url} | {reason}")
            self._reply(421, f"421 Misirected Request — {reason}".encode(),
                        {"X-Lab-Metered": "blocked"})
            return

        fwd_headers = {k: v for k, v in self.headers.items()
                       if k.lower() not in ("proxy-connection", "connection", "host")}
        fwd_headers["Host"] = host_header or dest_host
        status, rheaders, body = self._forward(dest, "GET",
                                               parsed.path or "/", fwd_headers)
        _, ch_m, ch_z, reason = self._meter(dest_host, host_header, len(body))
        bill_add(metered=ch_m, zero_rated=ch_z,
                 note=f"{'🟢 صِفر' if ch_z else '🔴 محاسَب'}: {url} (Host: {host_header}) — {reason}")
        self.send_response(status)
        for k, v in rheaders.items():
            if k.lower() not in ("transfer-encoding", "connection"):
                self.send_header(k, v)
        self.send_header("X-Lab-Metered", "zero-rated" if ch_z else "counted")
        self.send_header("X-Lab-Bill", f"metered={BILL['metered']},zero={BILL['zero_rated']}")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ── CONNECT (أنفاق VPN/التضليل تعتمد عليه) ──
    def do_CONNECT(self):
        target = self.path  # صيغة host:port
        if MODE["name"] == "fixed":
            bill_add(blocked=1, note=f"🚫 CONNECT مرفوض بالكامل: {target}")
            self._reply(403, "403 Forbidden — CONNECT معطّل في الوضع الآمن (الإصلاح الموصى به)".encode("utf-8"))
            return
        # الوضع الضعيف: يقبل فتح النفق (وهذا بالضبط ما يُستغَل)
        bill_add(zero_rated=0, note=f"⚠️ CONNECT مقبول (!) → {target} — النفق يُفتح بلا رقابة")
        try:
            host, _, port_s = target.rpartition(":")
            port = int(port_s or 443)
            # داخل المختبر نُحلّ الأسماء التجريدية عبر خريطة SITE_MAP
            mapped = SITE_MAP.get(host.lower())
            dest = mapped if mapped else (host, port)
            upstream = socket.create_connection(dest, timeout=5)
        except Exception as e:
            self._reply(502, f"502 — تعذّر فتح النفق: {e}".encode())
            return
        self.send_response(200, "Connection Established")
        self.end_headers()
        client = self.connection
        # نقل ثنائي الاتجاه حتى 4 ثوانٍ (يكفي للإثبات داخل المختبر)
        deadline = time.monotonic() + 4
        try:
            while time.monotonic() < deadline:
                r, _, _ = select.select([client, upstream], [], [], 0.4)
                if not r:
                    continue
                for s in r:
                    data = s.recv(65536)
                    if not data:
                        return
                    (upstream if s is client else client).sendall(data)
        except Exception:
            pass
        finally:
            try:
                upstream.close()
            except Exception:
                pass


# ───────────────────── تشغيل الخوادم ─────────────────────

def start_servers() -> list:
    servers = []
    for handler, host, port, name in (
        (SitesHandler, SITES_HOST, SITES_PORT, "المواقع"),
        (SellerHandler, SELLER_HOST, SELLER_PORT, "البائع"),
        (GatewayHandler, GATEWAY_HOST, GATEWAY_PORT, "البوابة"),
    ):
        srv = ThreadingHTTPServer((host, port), handler)
        srv.daemon_threads = True
        t = threading.Thread(target=srv.serve_forever, daemon=True)
        t.start()
        servers.append(srv)
        print(f"   ▸ {name}: http://{host}:{port}")
    return servers


# ───────────────────── عميل المختبر ─────────────────────

def lab_request(url: str, host_header: str, extra_headers: dict | None = None) -> tuple:
    """طلب عبر بوابة المختبر. يرجع (status, headers, body)."""
    headers = {"Host": host_header}
    if extra_headers:
        headers.update(extra_headers)
    conn = http.client.HTTPConnection(GATEWAY_HOST, GATEWAY_PORT, timeout=6)
    try:
        conn.request("GET", url, headers=headers)
        resp = conn.getresponse()
        return resp.status, dict(resp.getheaders()), resp.read().decode("utf-8", "replace")
    finally:
        conn.close()


def raw_connect_probe() -> str:
    """إرسال طلب CONNECT خام إلى البوابة وإرجاع سطر الاستجابة."""
    s = socket.create_connection((GATEWAY_HOST, GATEWAY_PORT), timeout=6)
    try:
        s.sendall(b"CONNECT seller.lab:9090 HTTP/1.1\r\nHost: seller.lab:9090\r\n\r\n")
        return s.recv(1024).decode("latin-1", "replace").split("\r\n")[0]
    finally:
        s.close()


# ───────────────────── السيناريوهات ─────────────────────

def banner(title: str) -> None:
    print("\n" + "═" * 64)
    print(f"  {title}")
    print("═" * 64)


def run_scenarios() -> bool:
    ok = True
    st = bill_snapshot()
    start = (st["metered"], st["zero_rated"], st["blocked"])

    # ── السيناريو 1: تصفح عادي عبر البوابة ──
    banner("① السيناريو العادي: تصفح موقع أخبار (وجهة محسوبة)")
    status, hdrs, _ = lab_request("http://news.example/", "news.example")
    st = bill_snapshot()
    print(f"   GET http://news.example/  →  HTTP {status}")
    print(f"   قرار البوابة: {hdrs.get('X-Lab-Metered')} — المحتسب حتى الآن: {st['metered'] - start[0]} بايت")
    print("   ✅ كما تتوقع: الموقع المحسوب يُخصم من رصيدك.")
    ok &= (status == 200 and hdrs.get("X-Lab-Metered") == "counted")

    # ── السيناريو 2: التضليل ضد البوابة الضعيفة ──
    banner("② الخدعة: تضليل Host نحو «سيرفر البائع» (البوابة الضعيفة)")
    print("   العميل يتصل فعلياً بـ seller.lab:9090 لكنه يرفع Host: games.example")
    status, hdrs, _ = lab_request(
        "http://seller.lab:9090/offer", "games.example",
        {"Cookie": "session=FAKE-BANK-TOKEN-1234", "User-Agent": "victim-phone"})
    st = bill_snapshot()
    print(f"   GET http://seller.lab:9090/offer + Host: games.example  →  HTTP {status}")
    print(f"   قرار البوابة: {hdrs.get('X-Lab-Metered')} — المحتسب الجديد: {st['metered'] - start[0]} بايت")
    print("   😱 البوابة اعتقدت أنه «ألعاب مفروضة» ولم تحسب شيئاً — الباقة «اشتغلت نت مجاني»!")
    print("\n   👁️ لكن… هذا ما رآه «سيرفر البائع» عنك:")
    with SELLER_LOCK:
        seen = SELLER_SEEN[-1] if SELLER_SEEN else {}
    for k in ("path", "host_header", "cookie", "user_agent"):
        print(f"      - {k}: {seen.get(k, '')}")
    print("   ‼️ كل شيء وصل للبائع: المسار، الكوكيز، الهوية. هكذا تُسرق الحسابات فعلياً.")
    ok &= (status == 200 and hdrs.get("X-Lab-Metered") == "zero-rated")

    # ── السيناريو 3: نفس الخدعة ضد البوابة الآمنة ──
    banner("③ الإصلاح: نفس التضليل ضد بوابة تُمسك مطابقة Host↔الوجهة")
    MODE["name"] = "fixed"
    print("   (شغّلنا وضع الحماية: مطابقة Host مع الوجهة الحقيقية + رفض التضليل)")
    status, hdrs, body = lab_request("http://seller.lab:9090/offer", "games.example")
    st = bill_snapshot()
    print(f"   GET http://seller.lab:9090/offer + Host: games.example  →  HTTP {status}")
    print(f"   ردّ البوابة: {body[:70]}…")
    print("   ✅ 421 Misdirected Request — الخدعة ماتت. هذه هي إصلاحات المشغّلين الموصى بها.")
    ok &= (status == 421)

    # تصفح شرعي بعد الإصلاح (الوجهة المفروضة الحقيقية تعمل كما يجب)
    status2, hdrs2, _ = lab_request("http://games.example/", "games.example")
    print(f"   وللمقارنة، الوجهة المفروضة الحقيقية: GET http://games.example/  →  "
          f"HTTP {status2} ({hdrs2.get('X-Lab-Metered')})")
    ok &= (status2 == 200 and hdrs2.get("X-Lab-Metered") == "zero-rated")

    # ── السيناريو 4: CONNECT ──
    banner("④ اختبار فتح النفق (CONNECT) — الضعيفة تقبل، الآمنة ترفض")
    MODE["name"] = "vulnerable"
    line1 = raw_connect_probe()
    print(f"   البوابة الضعيفة:   {line1}   ← النفق يُقبل (!) وهذا ما يبني عليه البائعون")
    MODE["name"] = "fixed"
    line2 = raw_connect_probe()
    print(f"   البوابة الآمنة:    {line2}   ← مرفوض. إغلاق CONNECT هو العلاج الجذري.")
    ok &= line1.startswith("HTTP/1.0 200") or line1.startswith("HTTP/1.1 200")
    ok &= line2.startswith("HTTP/1.0 403") or line2.startswith("HTTP/1.1 403")

    # ── الخلاصة ──
    banner("📊 ملخص «فاتورة» المختبر")
    st = bill_snapshot()
    print(f"   بايتات محتسبة على المشترك:  {st['metered']}")
    print(f"   بايتات «مفروضة» (بلا حساب):  {st['zero_rated']}")
    print(f"   طلبات مرفوضة (حماية):        {st['blocked']}")
    print("\n   الأحداث:")
    for e in st["events"]:
        print(f"     • {e}")
    banner("🎓 الدروس العملية (ثلاثة أسطر)")
    print("   1. أي فوترة تثق في حقل يتحكم به العميل (Host/SNI) قابلة للخداع.")
    print("   2. النفق ينتهي عند «البائع» ⇒ هو يرى كل شيء عنك — الاشتراك = تسليم بياناتك.")
    print("   3. العلاج معروف ومطبَّق في السيناريو 3: مطابقة Host↔الوجهة، إغلاق CONNECT،\n"
          "      وقوائم وجهات صارمة. أي شبكة تفعل هذا تقتل الخدع من جذورها.")
    print("\n" + "═" * 64)
    print("  ✅ نجحت جميع سيناريوهات المختبر." if ok else "  ❌ سيناريو ما لم يتحقق — راجع المخرجات.")
    print("═" * 64)
    return ok


def serve_forever() -> None:
    banner("🧪 zero-rating-lab — وضع الخوادم المستمرة (localhost فقط)")
    start_servers()
    print("""
الخوادم تعمل الآن. جرّب يدوياً:

  # تصفح عادي (محسوب):
  curl -x http://127.0.0.1:8080 http://news.example/

  # التضليل (ضد البوابة الضعيفة فقط — ابدأ أولاً بـ lab.py لتشغيل السيناريوهات
  # ثم أعد التشغيل بـ --serve وضع البوابة يبدأ "vulnerable"):
  curl -x http://127.0.0.1:8080 -H "Host: games.example" http://seller.lab:9090/offer

  # الوضع الآمن: غيّر MODE داخل الكود إلى "fixed" وأعد المحاولة → ستحصل على 421

اضغط Ctrl+C للإيقاف.""")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nتم إيقاف المختبر.")


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass
    p = argparse.ArgumentParser(description="مختبر محاكاة محلي لخدع «النت المجاني» (localhost فقط)")
    p.add_argument("--serve", action="store_true", help="إبقاء الخوادم تعمل لتجربة curl يدوياً")
    args = p.parse_args()

    print("""
╔══════════════════════════════════════════════════════════════╗
║  🧪 zero-rating-lab — مختبر محاكاة محلي 100% (localhost)     ║
╠══════════════════════════════════════════════════════════════╣
║  • لا يلمس أي شبكة حقيقية ولا يحوي أي هوست حقيقي.          ║
║  • يشرح أمام عينيك كيف تُخدع الفوترة وكيف تُمنع الخدع.      ║
║  • الأسماء (games.example / social.example / seller.lab)      ║
║    تجريدية لأغراض التعليم فقط.                              ║
╚══════════════════════════════════════════════════════════════╝""")
    if args.serve:
        serve_forever()
        return 0

    print("\n⏳ تشغيل خوادم المختبر…")
    start_servers()
    time.sleep(0.3)
    return 0 if run_scenarios() else 1


if __name__ == "__main__":
    sys.exit(main())
