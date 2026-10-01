(function () {
  // Dosya sayfada kazara ikinci kez çalışırsa sessizce durur, hata vermez
  if (window.__TENTIFOR_GUNCELLEME_YUKLENDI) return;
  window.__TENTIFOR_GUNCELLEME_YUKLENDI = true;

  const GUNCELLEME_ARALIK = 9e5,
    GUNCELLEME_ARKA_PLAN = 12e4;
  let guncellemeYeni = null,
    guncellemeSonBakis = 0,
    guncellemeGizlendi = 0;

  function sayfaPaketi() {
    const e = document.querySelector('meta[name="tentifor-paket"]');
    return e ? e.getAttribute("content") : "";
  }

  async function yayindakiPaket() {
    const e = await fetch("surum.json?t=" + Date.now(), { cache: "no-store" });
    if (!e.ok) return null;
    const t = await e.json();
    return t && typeof t.paket == "string" ? t : null;
  }

  function guncellemeBekletir() {
    const e = document.activeElement;
    return !(
      !(
        (e &&
          (e.tagName === "TEXTAREA" ||
            (e.tagName === "INPUT" &&
              !/^(button|submit|checkbox|radio|range|color)$/.test(e.type)) ||
            e.isContentEditable)) ||
        (typeof panelAcik == "function" && panelAcik())
      )
    );
  }

  function guncellemeUygula() {
    try {
      sessionStorage.setItem(
        "tentiforapp_guncellendi",
        (guncellemeYeni && guncellemeYeni.surum) || "1"
      );
    } catch {}
    location.reload();
  }

  function guncellemeCubugu() {
    if (!guncellemeYeni || document.querySelector("#guncellemeCubugu")) return;
    const e = document.createElement("div");
    e.id = "guncellemeCubugu";
    e.className = "guncelleme-cubugu";
    e.setAttribute("role", "status");
    e.innerHTML =
      "<span>Yeni sürüm hazır" +
      (guncellemeYeni.surum ? " (" + kacir(guncellemeYeni.surum) + ")" : "") +
      '</span><button class="dugme" data-guncelle>Yenile</button><button class="pencere-kapat" data-guncelle-kapat aria-label="Sonra">✕</button>';
    document.body.appendChild(e);
  }

  async function guncellemeBak(e) {
    const t = sayfaPaketi();
    if (!t || !navigator.onLine || (Date.now() - guncellemeSonBakis < 3e4 && !e))
      return;
    guncellemeSonBakis = Date.now();
    let n = null;
    try {
      n = await yayindakiPaket();
    } catch {
      return;
    }
    if (!(!n || n.paket === t)) {
      if (((guncellemeYeni = n), e && !guncellemeBekletir())) {
        guncellemeUygula();
        return;
      }
      guncellemeCubugu();
    }
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      guncellemeGizlendi = Date.now();
      return;
    }
    const e =
      guncellemeGizlendi && Date.now() - guncellemeGizlendi > 12e4;
    (guncellemeGizlendi = 0), guncellemeBak(e);
  });

  window.addEventListener("pageshow", function (e) {
    e.persisted && guncellemeBak(!0);
  });

  document.addEventListener("click", function (e) {
    const t =
      e.target.closest &&
      e.target.closest("[data-guncelle], [data-guncelle-kapat]");
    if (!t) return;
    if (t.hasAttribute("data-guncelle")) {
      guncellemeUygula();
      return;
    }
    const n = document.querySelector("#guncellemeCubugu");
    n && n.remove();
  });

  let guncellemeDokunuldu = !1;
  ["pointerdown", "keydown", "scroll"].forEach(function (e) {
    window.addEventListener(
      e,
      function () {
        guncellemeDokunuldu = !0;
      },
      { once: !0, passive: !0 }
    );
  });

  async function guncellemeAcilisBak() {
    const e = sayfaPaketi();
    if (
      !e ||
      !navigator.onLine ||
      !navigator.serviceWorker ||
      !navigator.serviceWorker.controller
    )
      return guncellemeBak(!1);
    guncellemeSonBakis = Date.now();
    let t = null;
    try {
      t = await yayindakiPaket();
    } catch {
      return;
    }
    if (!t || t.paket === e) return;
    guncellemeYeni = t;
    let n = "";
    try {
      n = sessionStorage.getItem("tentiforapp_acilis_yenilendi") || "";
    } catch {}
    if (n !== t.paket && !guncellemeDokunuldu && !guncellemeBekletir()) {
      try {
        sessionStorage.setItem("tentiforapp_acilis_yenilendi", t.paket);
      } catch {}
      setTimeout(guncellemeUygula, 600);
      return;
    }
    guncellemeCubugu();
  }

  window.addEventListener("load", function () {
    setTimeout(guncellemeAcilisBak, 1200);
    setInterval(function () {
      document.visibilityState === "visible" && guncellemeBak(!1);
    }, 9e5);
    try {
      const e = sessionStorage.getItem("tentiforapp_guncellendi");
      e &&
        (sessionStorage.removeItem("tentiforapp_guncellendi"),
        setTimeout(function () {
          typeof eckaBildir == "function" &&
            eckaBildir("Site güncellendi" + (e !== "1" ? " · " + e : ""));
        }, 1500));
    } catch {}
  });

  // Dışarıdan manuel tetiklemek gerekirse erişilebilir kalsın
  window.guncellemeBak = guncellemeBak;
  window.guncellemeUygula = guncellemeUygula;
})();
