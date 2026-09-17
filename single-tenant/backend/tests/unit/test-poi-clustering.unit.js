/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   Unit Tests: POI Clusterer & Classification Engine
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { poiClusterer } from "../../src/services/poi/POIClusterer.js";

describe("POIClusterer Unit Test Suite", () => {
  describe("1. Kuliner & Kafe Hybrid Resolution", () => {
    test("Memetakan brand kopi ternama secara deterministik ke 'Kafe & Kedai Kopi'", () => {
      const cases = [
        "Kopi Kenangan",
        "Janji Jiwa",
        "Fore Coffee",
        "Point Coffee",
        "Kopi Soe",
        "Kopi Kulo",
        "Starbucks Coffee",
        "Warkop Bu Siti",
        "Kedai Kopi Bahagia",
        "Kopikimi Dairy",
      ];

      for (const name of cases) {
        const cat = poiClusterer.cluster({ name });
        assert.equal(cat, "Kafe & Kedai Kopi", `Gagal mengklasifikasikan ${name}`);
      }
    });

    test("Memetakan tempat gabungan 'Cafe & Resto' ke 'Kafe & Kedai Kopi'", () => {
      const cases = [
        "Amor Resto & Cafe",
        "Brundy Cafe & Resto",
        "Terrace Cafe & Resto",
        "Deli Kafe & Resto",
      ];

      for (const name of cases) {
        const cat = poiClusterer.cluster({ name });
        assert.equal(cat, "Kafe & Kedai Kopi", `Gagal mengklasifikasikan ${name}`);
      }
    });

    test("Memetakan fast food dan restoran umum dengan benar", () => {
      assert.equal(poiClusterer.cluster({ name: "KFC Aloha" }), "Cepat Saji");
      assert.equal(poiClusterer.cluster({ name: "McDonald's Geluran" }), "Cepat Saji");
      assert.equal(poiClusterer.cluster({ name: "Mie Gacoan Sidoarjo" }), "Restoran");
      assert.equal(poiClusterer.cluster({ name: "Soto Ayam Cak Har" }), "Restoran");
      assert.equal(poiClusterer.cluster({ name: "Holland Bakery Buduran" }), "Toko Roti & Kue");
      assert.equal(poiClusterer.cluster({ name: "Mixue Ice Cream & Tea" }), "Toko Minuman");
    });
  });

  describe("2. Objek Wisata, Budaya & Hiburan", () => {
    test("Memetakan candi, museum, monumen, situs, bioskop, dan karaoke ke 'Objek Wisata & Budaya'", () => {
      const cases = [
        "Candi Pari",
        "Candi Tawangalun",
        "Museum Empu Tantular",
        "Monumen Pesawat Tempur",
        "Monumen Pahlawan",
        "Situs Tarik Raden Wijaya Majapahit",
        "Happy Puppy Suncity",
        "Bioskop Mini Sukodono",
        "Nav Karaoke Sidoarjo",
        "Tugu Batas Desa Grogol - Modong",
      ];

      for (const name of cases) {
        const cat = poiClusterer.cluster({ name });
        assert.equal(cat, "Objek Wisata & Budaya", `Gagal mengklasifikasikan ${name}`);
      }
    });

    test("Memetakan tag OSM tourism dan cinema ke 'Objek Wisata & Budaya'", () => {
      assert.equal(poiClusterer.cluster({ tourism: "museum", name: "Balai Seni" }), "Objek Wisata & Budaya");
      assert.equal(poiClusterer.cluster({ amenity: "cinema", name: "Teater XXI" }), "Objek Wisata & Budaya");
      assert.equal(poiClusterer.cluster({ tourism: "attraction", name: "Wahana Air" }), "Objek Wisata & Budaya");
    });
  });

  describe("3. Keyword Boundary & Retail vs Edukasi", () => {
    test("Memastikan 'Toko Seragam Sekolah' tidak tertangkap sebagai 'Sekolah'", () => {
      assert.equal(poiClusterer.cluster({ name: "Prima Jaya Seragam Sekolah" }), "Toko Retail (Umum)");
      assert.equal(poiClusterer.cluster({ name: "Toko Seragam Bintang" }), "Toko Retail (Umum)");
    });

    test("Memastikan institusi pendidikan tetap terklasifikasi akurat", () => {
      assert.equal(poiClusterer.cluster({ name: "SDN Pucang 1" }), "Sekolah Dasar (SD/MI)");
      assert.equal(poiClusterer.cluster({ name: "SMPN 1 Sidoarjo" }), "Sekolah Menengah Pertama (SMP/MTs)");
      assert.equal(poiClusterer.cluster({ name: "SMAN 1 Sidoarjo" }), "Sekolah Menengah Atas (SMA/SMK/MA)");
      assert.equal(poiClusterer.cluster({ name: "Universitas Negeri Surabaya" }), "Perguruan Tinggi");
    });
  });

  describe("4. Korporasi & Perkantoran", () => {
    test("Memetakan perusahaan korporasi ke 'Perkantoran Komersial'", () => {
      const cases = [
        "Bentoel Group Asmo Surabaya",
        "Sociodreams",
        "Indocev",
        "PT Mega Persada Nusantara",
        "CV Sinar Makmur",
      ];

      for (const name of cases) {
        const cat = poiClusterer.cluster({ name });
        assert.equal(cat, "Perkantoran Komersial", `Gagal mengklasifikasikan ${name}`);
      }
    });
  });

  describe("5. Noise & Personal Residence Filtering (Lapis 0)", () => {
    test("Mengeksklusi dan mengabaikan residensial pribadi atau data uji", () => {
      const noiseCases = [
        "omah bu feling",
        "pak bambang",
        "Rama Wijaya Home",
        "Kastil Cimon",
        "HOME",
        "RUMAH Q",
        "TEMPAT BEOL",
        "TEST POI",
      ];

      for (const name of noiseCases) {
        const cat = poiClusterer.cluster({ name });
        assert.equal(cat, "IGNORED", `Gagal memfilter noise ${name}`);
        
        const status = poiClusterer.classifyOperationalStatus({ name });
        assert.equal(status.operational_status, "EXCLUDED", `Gagal meng-exclude noise ${name}`);
      }
    });
  });
});
