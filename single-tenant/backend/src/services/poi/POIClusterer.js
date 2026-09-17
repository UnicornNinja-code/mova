/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   POI Category Clustering Engine (2-Layered Name-Based Regex & OSM Tag Fallback)
 */

export class POIClusterer {
  static instance = null;

  constructor() {
    if (POIClusterer.instance) {
      return POIClusterer.instance;
    }
    POIClusterer.instance = this;
  }

  static getInstance() {
    if (!POIClusterer.instance) {
      POIClusterer.instance = new POIClusterer();
    }
    return POIClusterer.instance;
  }

  /**
   * Deterministic Operational Status Classification Layer (Phase 2)
   */
  classifyOperationalStatus(tags = {}) {
    const highway = String(tags.highway || "").toLowerCase().trim();
    const amenity = String(tags.amenity || "").toLowerCase().trim();
    const access = String(tags.access || "").toLowerCase().trim();
    const aeroway = String(tags.aeroway || "").toLowerCase().trim();
    const military = String(tags.military || "").toLowerCase().trim();

    // 1. Rest Area / Motorway Controlled Services (HIGHEST PRIORITY)
    if (highway === "services" || highway === "rest_area" || amenity === "rest_area") {
      return {
        operational_status: "EXCLUDED",
        exclusion_reason: "REST_AREA",
      };
    }

    // 2. Restricted / Private Access
    if (access === "private" || access === "no") {
      return {
        operational_status: "EXCLUDED",
        exclusion_reason: "PRIVATE_ACCESS",
      };
    }

    // 3. Restricted Facilities (Airport / Military)
    if (aeroway || military) {
      return {
        operational_status: "EXCLUDED",
        exclusion_reason: "RESTRICTED_FACILITY",
      };
    }

    return {
      operational_status: "ELIGIBLE",
      exclusion_reason: null,
    };
  }

  /**
   * Main clustering entry point for mapping OSM tags & name to standard POI category
   */
  cluster(tags = {}) {
    // Ignore airport / military areas
    if (tags.aeroway || tags.military) return "IGNORED";

    const placeName = (tags.name || "").toUpperCase().trim();
    const { amenity, shop, leisure, office, building, tourism, public_transport, religion, landuse } = tags;

    // -------------------------------------------------------------------
    // LAPIS 0: Blacklist Filter Data Uji & Personal/Noise
    // -------------------------------------------------------------------
    if (placeName) {
      if (
        placeName.match(/\b(TEST|TEMPAT BEOL|GREEN ZONE|KDO 12)\b/) ||
        placeName === "HOME" ||
        placeName.startsWith("RUMAH Q")
      ) {
        return "IGNORED";
      }
    }

    // -------------------------------------------------------------------
    // LAPIS 1: Priority Explicit Tag & Name-Based Clustering
    // -------------------------------------------------------------------

    // 1. TEMPAT IBADAH (PRIORITAS UTAMA - Cegah "Taman" pada Masjid Taman Pinang)
    if (amenity === "place_of_worship" || placeName.match(/\b(MASJID|MUSHOLA|MUSHALA|MUSHOLAH|MUSHOLLAH|MUSHOLLA|LANGGAR|GEREJA|CHURCH|GBI|GKP|GPIB|GSJPDI|PURA|VIHARA|BAITUT|BAITUL|BAITUS|HIDAYATUL|BABUS SALAM|BETHESDA|SABDA HAYAT|MIFTAHUL|RAUDHATUL|ROUDHOTUL)\b/) || placeName.startsWith("AL-") || placeName.startsWith("AL ")) {
      if (religion === "muslim" || placeName.match(/\b(MASJID|MUSHOLA|MUSHALA|MUSHOLLAH|MUSHOLLA|LANGGAR|BAITUT|BAITUL|BAITUS|HIDAYATUL|BABUS SALAM|MIFTAHUL|RAUDHATUL|ROUDHOTUL)\b/) || placeName.startsWith("AL-") || placeName.startsWith("AL ")) return "Masjid & Mushola";
      if (religion === "christian" || religion === "catholic" || placeName.match(/\b(GEREJA|CHURCH|GBI|GKP|GPIB|GSJPDI|BETHESDA|SABDA HAYAT)\b/)) return "Gereja";
      if (religion === "hindu" || placeName.match(/\b(PURA)\b/)) return "Pura";
      if (religion === "buddhist" || placeName.match(/\b(VIHARA)\b/)) return "Vihara";
      return "Tempat Ibadah (Lainnya)";
    }

    if (placeName) {
      // 2. KESEHATAN (SPESIFIK: APOTEK, RS, KLINIK)
      if (amenity === "pharmacy" || placeName.match(/\b(APOTEK|APOTIK|PHARMACY|K24|K-24|KIMIA FARMA)\b/)) return "Apotek";
      if (amenity === "hospital" || placeName.match(/\b(RUMAH SAKIT|RSU|RSUD|RSIA|HOSPITAL|RS)\b/)) return "Rumah Sakit";
      if (amenity === "clinic" || amenity === "doctors" || placeName.match(/\b(KLINIK|CLINIC|PUSKESMAS|MEDICA|MEDIKA|MITRA HUSADA|ALMIRA MEDIKA|POSKO PMI|PMI|DOKTER|DR\.)\b/)) return "Klinik & Puskesmas";

      // 3. TRANSPORTASI & TRANSIT (SPESIFIK: STASIUN, HALTE/TERMINAL, SHELTER)
      if (public_transport === "station" || tags.railway === "station" || placeName.match(/\b(STASIUN|STASIUN KERETA|RAILWAY STATION|COMMUTER LINE)\b/)) return "Stasiun Kereta Api";
      if (public_transport === "bus_stop" || amenity === "bus_station" || placeName.match(/\b(HALTE|TERMINAL|TERMINAL BUS|BUS STOP|BUS STATION|REDBUS)\b/)) return "Halte / Terminal Bus";
      if (placeName.match(/\b(GOJEK|OJEK|GOJEK POINT|SHELTER|LOKET|TRANS|ADHITRANS|SWK TRANSLOGISTIC)\b/)) return "Fasilitas Transit & Shelter";

      // 4. KULINER & KAFE (SPESIFIK: FOOD COURT, CEPAT SAJI, RESTORAN, MINUMAN, KAFE, ROTI)
      if (amenity === "food_court" || placeName.match(/\b(FOOD COURT|FOODCOURT|PUJASERA|PAZKUL|SWK)\b/)) return "Food Court";
      if (amenity === "fast_food" || placeName.match(/\b(KFC|MCDONALD|MCDONALDS|MCD|BURGER|BURGER KING|HISANA|PIZZA|PIZZA HUT|CARL'S|CARLS|BEARD PAPA|RICE BOWL|SOLARIA|RICHEESE|D'COST|HOKBEN|A&W|TOBY'S|TOBYS|MC DONALD)\b/)) return "Cepat Saji";
      if (amenity === "restaurant" || placeName.match(/\b(RESTAURANT|RESTORAN|RM|RESTO|GEPREK|SUPREK|PECEL|RAWON|SOTO|SATE|MIE|NASGOR|NASI GORENG|PANGSIT|BAKSO|KITCHEN|CRISPY|GADO GADO|GADO-GADO|SAMBEL|SAMBAL|WANGKRINGAN|FOOD|LEKO|SARI RASA|TOUS LES JOURS|WONG SOLO|MIE GACOAN|MIE SETAN|IBC|DEPOT|AYAM|BEBEK|IKAN BAKAR|GUDEG)\b/)) return "Restoran";
      if (placeName.match(/\b(ES TEH|ESTEH|TEH POCI|BOBA|CHATIME|CHA TIME|MIXUE|MOMOYO)\b/)) return "Toko Minuman";
      if (amenity === "cafe" || placeName.match(/\b(WARKOP|WARUNG KOPI|KOPI|ANGKRINGAN|EXCELSO|QUICKLY|CAFE|KAFE|KEDAI KOPI|COFFEE|ROASTER|STARBUCKS)\b/)) return "Kafe & Kedai Kopi";
      if (shop === "bakery" || placeName.match(/\b(BAKERY|DONAT|DONUT|DONUTS|ROTI|KUE|PASTRY|BENARDI)\b/)) return "Toko Roti & Kue";

      // 5. RETAIL, PERBELANJAAN & PASAR (SPESIFIK: MINIMARKET, SUPERMARKET, MALL, PASAR, RETAIL)
      if (shop === "convenience" || placeName.match(/\b(INDOMARET|INDOMART|ALFAMART|ALFAMIDI|ALFA MIDI|CIRCLE K|CIRCLES K|FAMILYMART|PRIMA MART|LAWSON|YOMART|MART|7-ELEVEN|MINIMARKET|MINI MARKET|MINIPREÇO|ABNISA|ANDISMART|GREENSMART)\b/)) return "Minimarket";
      if (shop === "supermarket" || placeName.match(/\b(SUPERMARKET|SUPER INDO|SUPERINDO|GIANT|HERO|LOTTE MART|LOTTE|HYPERMART|TRANSMART|AZKO)\b/)) return "Supermarket";
      if (shop === "mall" || placeName.match(/\b(PLAZA|MALL|DEPARTMENT STORE|RAMAYANA|PGS|MR\.DIY|MR DIY|MRDIY|BOGAJAYA|UNIQLO|PERTOKOAN)\b/)) return "Mall / Pusat Perbelanjaan";
      if (amenity === "marketplace" || placeName.match(/\b(PASAR)\b/)) return "Pasar Tradisional";

      // 6. MATERIAL, MEBEL, ELEKTRONIK, SALON & RETAIL
      if (shop === "doityourself" || shop === "hardware" || shop === "building_materials" || placeName.match(/\b(MATERIAL|GALANGAN|BANGUNAN|TOKO BESI|DEPO BANGUNAN|MITRA10|MITRA 10|ALUMINIUM)\b/)) return "Toko Bangunan";
      if (shop === "furniture" || placeName.match(/\b(MEBEL|FURNITURE|FURNITUR)\b/)) return "Toko Mebel";
      if (shop === "mobile_phone" || placeName.match(/\b(SAMSUNG|OPPO|VIVO|XIAOMI|IPHONE|APPLE|CELLULAR|COUNTER HP|GADGET)\b/)) return "Toko HP & Gadget";
      if (placeName.match(/\b(XL|TELKOMSEL|GRAPARI|INDOSAT|SMARTFREN|TRI|CENTRAL CELL|PROVIDER)\b/)) return "Provider & Telekomunikasi";
      if (shop === "electronics" || placeName.match(/\b(ELECTRIC|ELECTRONIC|ELEKTRONIK|ELEKTRIK)\b/)) return "Toko Elektronik";
      if (shop === "hairdresser" || shop === "beauty" || placeName.match(/\b(BARBER|BARBERSHOP|PANGKAS RAMBUT|POTONG RAMBUT|SALON|MUA|BEAUTY|MSGLOW|MS GLOW|LBC|LONDON BEAUTY CENTRE)\b/)) return "Pangkas Rambut & Salon";
      if (placeName.match(/\b(STUDIO|FOTO|PHOTOGRAPHY|PHOTO)\b/)) return "Studio & Fotografi";
      if (placeName.match(/\b(JNE|J&T|JNT|SICEPAT|POS INDONESIA|TIKI|LOGISTIK|LOGISTIC|EXPEDITION|WAREHOUSE|GUDANG|LALAMOVE|CARGO|NINJA)\b/)) return "Jasa Pengiriman & Logistik";
      if (shop || placeName.match(/\b(OLEH-OLEH|OLEH OLEH|BORDIR|BUSANA|PAKAIAN|BATIK|BENANG|TAS|BAJU|FASHION|CLOTHING|BOUTIQUE|TOKO|AGEN|UD\.|INDAH BORDIR|INTAKO|PIJAT|HERBAL|PERFUME|PARFUM|OPTIK|LAUNDR|LAUNDRY|LOUNDRE|PRINTING|JAHIT)\b/)) return "Toko Retail (Umum)";

      // 7. PENDIDIKAN & PESANTREN
      if (placeName.match(/\b(SD|SDN|MI|MIN|SEKOLAH DASAR|SDK|MINU|MIS)\b/)) return "Sekolah Dasar (SD/MI)";
      if (placeName.match(/\b(SMP|SMPN|MTS|MTSN|SEKOLAH MENENGAH PERTAMA|SMPK)\b/)) return "Sekolah Menengah Pertama (SMP/MTs)";
      if (placeName.match(/\b(SMA|SMAN|SMK|SMKN|MA|MAN|SEKOLAH MENENGAH ATAS|SEKOLAH MENENGAH KEJURUAN)\b/)) return "Sekolah Menengah Atas (SMA/SMK/MA)";
      if (amenity === "kindergarten" || placeName.match(/\b(PAUD|TK|TKK|TAMAN KANAK|KINDERGARTEN)\b/)) return "Taman Kanak-Kanak / PAUD";
      if (amenity === "university" || amenity === "college" || placeName.match(/\b(IAI|UNIVERSITY|UNIVERSITAS|KAMPUS|STAI|UMAHA|POLITEKNIK|INSTITUT|STIE|AKADEMI|COLLEGE)\b/)) return "Perguruan Tinggi";
      if (placeName.match(/\b(PESANTREN|PONDOK PESANTREN|KUTTAB|ZAINUDDIN)\b/)) return "Pondok Pesantren";
      if (amenity === "school" || placeName.match(/\b(SEKOLAH|SCHOOL|MADRASAH|BIMBEL|PRIMAGAMA|GANESHA|KURSUS|ENGLISH FIRST|EF|PERPUSTAKAAN|SLB|LEMBAGA PENDIDIKAN|YAYASAN)\b/)) return "Sekolah (Umum)";

      // 8. LAYANAN PEMERINTAHAN & PUBLIK
      if (office === "government" || amenity === "police" || placeName.match(/\b(BADAN|BPK-RI|BPKP|DISPENDA|DISPERINDAG|KEJAKSAAN|KPU|KOMISI|PENGADILAN|SAMSAT|SEKRETARIAT|KPP|ODITURAT|KANTOR|KECAMATAN|KELURAHAN|BAPAS|POLANTAS|POLISI|POLRES|POLSEK|BUM DESA|PLN|PDAM|LAPAS|RUTAN|LEMBAGA PEMASYARAKATAN|TELKOM|POS|TPST|PUSDIK|DINAS|BPN|PEMERINTAHAN|BPJS)\b/)) return "Layanan Pemerintahan";

      // 9. FASILITAS WARGA, OTOMOTIF & AKOMODASI
      if (placeName.match(/\b(BALAI|BALEDESA|GEDUNG SERBAGUNA|POS KAMLING|POSYANDU|GKP|GEDUNG|GRAHA)\b/)) return "Fasilitas Warga & Balai";
      if (placeName.match(/\b(BENGKEL|AHASS|MOTOR|OTOMOTIF|BRIDGESTONE|PLANET BAN|CUCI MOTOR|CUCI MOBIL|SERVICE|SUZUKI|YAMAHA|HONDA|HYUNDAI|TAMBAL BAN|AUTO CARE|OLXMOBBI|RAJA MOBIL|AGEN COVER)\b/)) return "Bengkel & Otomotif";
      if (amenity === "hotel" || amenity === "hostel" || amenity === "guest_house" || building === "apartments" || tourism === "hotel" || tourism === "guest_house" || placeName.match(/\b(HOTEL|FAVEHOTEL|FAVE HOTEL|HOSTEL|GUEST HOUSE|APARTMENT|APARTEMEN|IBIS|OYO|KONTRAKAN|KOST|KOS|HOMESTAY|PENGINAPAN|LOSMEN|VILLA|WISMA|PONDOK INAP|INN|SYARIAH|PREMIER PLACE|SWISS-BELINN|SWISS BELIN|ZEIDAN HOUSE|TROPODO)\b/)) return "Hotel & Penginapan";

      // 10. TAMAN, OLAHRAGA & REKREASI (TAMAN KOTA HARUS TERKONTROL)
      if (leisure === "park" || leisure === "garden" || placeName.match(/\b(ALUN-ALUN|ALUN ALUN|BUNDERAN|BUNDARAN|FARMLAND|SITE)\b/) || (placeName.includes("TAMAN KOTA") || placeName.includes("TAMAN REKREASI") || placeName.startsWith("TAMAN ") || placeName.endsWith(" PARK") || placeName === "TAMAN")) return "Taman Kota / Terbuka";
      if (leisure === "pitch" || leisure === "stadium" || leisure === "sports_centre" || placeName.match(/\b(OLAHRAGA|GELORA|JOGGING|GOR|STADION|LAPANGAN|FUTSAL|BADMINTON|FITNESS|GYM|SPORT|GOLF|SPORTS CLUB|SOCCER FIELD)\b/)) return "Fasilitas Olahraga";
      if (leisure === "water_park" || leisure === "swimming_pool" || placeName.match(/\b(WATERPARK|WATERBOOM|KOLAM RENANG|SWIMMING POOL|REKREASI AIR)\b/)) return "Kolam Renang / Rekreasi Air";

      // 11. BANK, ATM, SPBU, PARKIR & PEMAKAMAN
      if (amenity === "atm" || placeName.match(/\b(ATM|GALERI ATM|DRIVE-THRU ATM|DRIVE THRU ATM|MESIN TUNAI|CRM)\b/)) return "ATM / Mesin Tunai";
      if (amenity === "bank" || placeName.match(/\b(BANK|BCA|BRI|BNI|MANDIRI|BSI|DANAMON|PERMATA|CIMB|BTN|PANIN|MAYBANK|PEGADAIAN|LEASING|KOPERASI|KSP)\b/)) return "Bank & Finansial";
      if (office === "company" || building === "commercial" || building === "office" || placeName.match(/\b(PT\.|PT|CV\.|CV|KANTOR|OFFICE|HEAD OFFICE|BRANCH OFFICE|TOWER|COMMERCIAL)\b/)) return "Perkantoran Komersial";
      if (placeName.match(/\b(POM|POM BENSIN|SPBU|PERTAMINA|SHELL|BP|AKR)\b/)) return "SPBU / Stasiun Pengisian Bahan Bakar";
      if (amenity === "parking" || amenity === "motorcycle_parking" || placeName.match(/\b(PARKIR|PARKING|PARKIRAN)\b/)) return "Fasilitas Parkir";
      if (amenity === "grave_yard" || amenity === "cemetery" || landuse === "cemetery" || placeName.match(/\b(MAKAM|PEMAKAMAN|GRAVEYARD|CEMETERY|TPU|QUBURAN|KUBURAN)\b/)) return "Pemakaman";
    }

    // -------------------------------------------------------------------
    // LAPIS 2: OSM Tag-Based Clustering (Fallback jika nama tidak match)
    // -------------------------------------------------------------------

    // Tempat Ibadah
    if (amenity === "place_of_worship") {
      if (religion === "muslim") return "Masjid & Mushola";
      if (religion === "christian" || religion === "catholic") return "Gereja";
      if (religion === "hindu") return "Pura";
      if (religion === "buddhist") return "Vihara";
      return "Tempat Ibadah (Lainnya)";
    }

    // Finansial
    if (amenity === "atm") return "ATM / Mesin Tunai";
    if (amenity === "bank") return "Bank & Finansial";

    // Kesehatan
    if (amenity === "pharmacy") return "Apotek";
    if (amenity === "hospital") return "Rumah Sakit";
    if (amenity === "clinic" || amenity === "doctors") return "Klinik & Puskesmas";

    // Transportasi
    if (public_transport === "bus_stop" || amenity === "bus_station") return "Halte / Terminal Bus";
    if (public_transport === "station" || tags.railway === "station") return "Stasiun Kereta Api";

    // Akomodasi
    if (amenity === "hotel" || amenity === "hostel" || amenity === "guest_house" || building === "apartments" || tourism === "hotel" || tourism === "guest_house") return "Hotel & Penginapan";

    // Kuliner & Perbelanjaan
    if (amenity === "fast_food") return "Cepat Saji";
    if (amenity === "cafe") return "Kafe & Kedai Kopi";
    if (amenity === "food_court") return "Food Court";
    if (amenity === "restaurant") return "Restoran";
    if (shop === "bakery") return "Toko Roti & Kue";
    if (shop === "convenience") return "Minimarket";
    if (shop === "supermarket") return "Supermarket";
    if (shop === "mall") return "Mall / Pusat Perbelanjaan";
    if (amenity === "marketplace") return "Pasar Tradisional";

    // Material & Retail Spesifik
    if (shop === "doityourself" || shop === "hardware" || shop === "building_materials") return "Toko Bangunan";
    if (shop === "furniture") return "Toko Mebel";
    if (shop === "mobile_phone") return "Toko HP & Gadget";
    if (shop === "hairdresser" || shop === "beauty") return "Pangkas Rambut & Salon";
    if (shop) return "Toko Retail (Umum)";

    // Pendidikan & Pemerintahan
    if (amenity === "university" || amenity === "college") return "Perguruan Tinggi";
    if (amenity === "kindergarten") return "Taman Kanak-Kanak / PAUD";
    if (amenity === "school") return "Sekolah (Umum)";
    if (office === "government" || amenity === "police") return "Layanan Pemerintahan";
    if (office === "company" || building === "commercial" || building === "office") return "Perkantoran Komersial";

    // Ruang Publik & Olahraga
    if (leisure === "park" || leisure === "garden") return "Taman Kota / Terbuka";
    if (leisure === "pitch" || leisure === "stadium" || leisure === "sports_centre") return "Fasilitas Olahraga";
    if (leisure === "water_park" || leisure === "swimming_pool") return "Kolam Renang / Rekreasi Air";

    // Parkir & Pemakaman
    if (amenity === "parking" || amenity === "motorcycle_parking") return "Fasilitas Parkir";
    if (amenity === "grave_yard" || amenity === "cemetery" || landuse === "cemetery") return "Pemakaman";

    return "Lainnya";
  }
}

export const poiClusterer = POIClusterer.getInstance();
