import assert from "node:assert/strict";
import test from "node:test";
import { categoryOf } from "../src/lib/job-categories";

const examples = [
  ["Perawat", "kesehatan"], ["Tenaga Teknis Kefarmasian", "kesehatan"], ["Quality Assurance Pharmacy", "kesehatan"], ["Admisi Rumah Sakit", "kesehatan"], ["ATLM", "kesehatan"],
  ["Finance & Accounting", "keuangan"], ["Staf Perpajakan", "keuangan"], ["Internal Audit", "keuangan"],
  ["HRGA Intern", "sdm"], ["People Partner Intern", "sdm"], ["Human Capital & Data Intern", "sdm"],
  ["Digital Marketing", "pemasaran"], ["Account Executive", "pemasaran"], ["Merchandiser Intern", "pemasaran"], ["Technical SEO", "pemasaran"],
  ["UI/UX Designer", "desain"], ["Desainer Grafis Kemasan", "desain"], ["Video Editor", "desain"],
  ["Analis Hukum", "hukum"], ["Legal Compliance", "hukum"],
  ["Mechanical Engineer", "teknik"], ["Civil Engineering Intern", "teknik"], ["ELECTRICAL MAINTENANCE", "teknik"], ["Engineering Internship", "teknik"],
  ["Inventory Admin", "logistik"], ["Procurement Support", "logistik"],
  ["QC Staff Intern", "manufaktur"], ["PROCESS ENGINEERING", "manufaktur"],
  ["Guru Bahasa Inggris", "pendidikan"], ["Penerjemah Kurikulum", "pendidikan"],
  ["Agronomist", "pertanian"], ["Budidaya Perikanan", "pertanian"],
  ["Junior Cook", "pariwisata"], ["Hotel Receptionist", "pariwisata"],
  ["EHS Internship", "lingkungan"], ["Environmental Engineer", "lingkungan"],
  ["Asisten Periset Biologi", "riset"], ["Tenaga Laboratorium", "riset"],
  ["Fasilitator Pendamping", "publik"], ["Fasilititator Pendamping", "publik"], ["Staf Pelayanan Haji dan Umrah", "publik"],
  ["Strategy & Business Performance", "bisnis"], ["Project Management", "bisnis"],
  ["Admin Sekretariat", "administrasi"], ["General Affair Intern", "administrasi"],
  ["AI/ML Engineer Intern", "ai"], ["Machine Learning Engineer", "ai"], ["Deep Learning Engineer", "ai"], ["Machine Learning Instructor", "pendidikan"], ["Data Engineer", "data"], ["Software Engineering", "dev"], ["Teknisi IT", "it"], ["IT Infrastructure Internship", "it"],
  ["Posisi belum dijelaskan", "lain"],
] as const;
for (const [title, expected] of examples) test(`job field: ${title} → ${expected}`, () => assert.equal(categoryOf(title), expected));
