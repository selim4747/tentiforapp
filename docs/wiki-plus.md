# Evren Wiki Plus

TentiFor ansiklopedisi, gerçek zamanlı ortak düzenleme olmadan klasik wiki deneyiminin temel parçalarını destekler.

## İçerik

Madde özeti, giriş ve açıklama alanları güvenli bir Markdown alt kümesini destekler: başlıklar, kalın/italik metin, kod, madde listeleri ve yalnızca HTTPS bağlantıları. HTML çalıştırılmaz; bağlantılar yeni sekmede `noopener noreferrer` ile açılır.

Kategori şeması bilgi kutusu alanlarını tanımlar. Kategoriler isterse `parentId` alanıyla hiyerarşik kategori ağacına dönüştürülebilir. JSON yedekleri, revision geçmişini, ilişkileri, kaynakçayı ve Markdown metnini korur.

## Revision ve geri bağlantılar

Her madde değişikliği önceki snapshot’ı revision geçmişine ekler. Editör geçmiş ekranında alan bazlı eski/yeni karşılaştırması ve güvenli geri alma bulunur. Okur görünümünde, diğer yayımlanmış maddelerin bu maddeye verdiği bağlantılar “Bu maddeye bağlantılar” bölümünde listelenir.

## Tartışma ve yorumlar

Uygulama içinde yorum verisi veya GitHub token saklanmaz. Her yayımlanmış maddenin altındaki **GitHub'ta tartış / düzeltme öner** bağlantısı, varsayılan olarak `selim4747/tentiforapp` deposunda yeni bir Issue açar ve evren ile madde kimliğini gövdeye ekler. Kurulum sahibi isterse `window.TENTIFOR_GITHUB_REPO = 'org/repo'` veya `window.tentiforConfig.githubRepo` ile hedef deposunu değiştirebilir.

Bu model, ileride gerçek bir sunucuya geçildiğinde issue bağlantılarının merkezi yorum sistemine dönüştürülebilmesini sağlar; mevcut uygulama kullanıcı erişim token’larını istemciye gömmez.
