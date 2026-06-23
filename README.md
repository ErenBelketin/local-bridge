# Local-Bridge 🌐
> **"Kendine WhatsApp'tan Mesaj Atma Derdine Son!"**

Apple ekosistemi (Airdrop) olmayan kullanıcılar için, bilgisayarlar ve mobil cihazlar (Android/iOS) arasında kablosuz, internet kotası yemeden, yerel ağ (Wi-Fi) üzerinden anlık dosya, fotoğraf ve pano (metin/link) transferi yapan ultra optimize web uygulaması.

---

## ⚡ Neden Hayat Kurtarır?
- **Sıfır Kurulum (Telefonda):** Bilgisayarda çalışan sunucu size bir QR kod üretir. Telefonun kamerasıyla bu kodu tarattığınız anda telefonunuzda paylaşım sayfası açılır.
- **Yerel ve Kotasız:** Tüm dosya transferleri internete çıkmadan, doğrudan yerel ağınız (Wi-Fi) üzerinden gerçekleşir. İnternet paketinizi tüketmez ve internet hızından bağımsız, Wi-Fi bant genişliğinizin sınırlarında (saniyeler içinde) tamamlanır.
- **Ultra Optimize (Düşük Kaynak Tüketimi):** Task Manager (Görev Yöneticisi) üzerinde neredeyse sıfır CPU ve RAM yükü bindirecek şekilde tasarlanmıştır. Sunucu olayları için ağır kütüphaneler yerine tarayıcıyla dahili gelen **SSE (Server-Sent Events)** kullanılmıştır. Yüklemeler RAM'i doldurmak yerine doğrudan diske akıtılır (**Disk-streamed Multer**).

---

## 🚀 Nasıl Çalıştırılır?
1. Bilgisayarınızda **Node.js** yüklü olduğundan emin olun (Önerilen: v18+).
2. Proje dizinindeki `start.bat` dosyasına çift tıklayarak sunucuyu başlatın (ya da terminalde `npm start` yazın).
3. Bilgisayar ekranınızda veya konsolda çıkan adresi görün.
4. Telefonunuzun kamerası ile ekrandaki QR kodu okutun.
5. Paylaşımların tadını çıkarın!

---

## 🌟 Öne Çıkan Özellikler
- **Gerçek Zamanlı Senkronizasyon:** Bilgisayardan veya telefondan eklenen her dosya veya metin, bağlı olan tüm diğer cihazlarda anında belirir (SSE teknolojisiyle gecikmesiz).
- **Global Yapıştırma (Ctrl + V):** Web sayfasındayken herhangi bir alana tıklamadan doğrudan `Ctrl + V` yaparsanız, panonuzdaki metin, link veya kopyalanan ekran görüntüsü/dosya anında otomatik olarak paylaşılır!
- **Gelişmiş Dosya Önizleme:** Fotoğraflar, videolar ve ses dosyaları tarayıcı içinde önizlenebilir veya oynatılabilir.
- **Gelişmiş Panoya Kopyalama:** Güvensiz ağlarda (HTTP) tarayıcıların pano erişim kısıtlamalarını aşan özel bir geri çekilme (fallback) mekanizmasıyla sorunsuz kopyalama desteği.
- **Filtreleme ve Arama:** Paylaşılan ögeler içinde gerçek zamanlı arama yapabilir ve türe göre (Metin, Bağlantı, Dosya) süzebilirsiniz.
