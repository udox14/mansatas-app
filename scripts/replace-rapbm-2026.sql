-- Explicitly authorized on 2026-11-25: replace unactivated RAPBM 2026 (cohort 2026)
-- before any SPB or cashflow allocation exists, preserving all RAPBM triggers and audit logs.
INSERT INTO fin_komite_transaction_guard SELECT 1, 0 WHERE NOT (
  EXISTS (SELECT 1 FROM fin_rapbm_years WHERE year=2026 AND active_version_id='b18f2231-995c-4ea5-b3cc-de9b73076ff7' AND publication_revision=1)
  AND (SELECT COUNT(*) FROM fin_rapbm_versions WHERE year=2026 OR komite_cohort=2026)=1
  AND EXISTS (SELECT 1 FROM fin_rapbm_versions WHERE id='b18f2231-995c-4ea5-b3cc-de9b73076ff7' AND year=2026 AND version=1 AND status='published' AND komite_cohort=2026 AND source_sha256='f3005a3c814857c2b02c38e4c7551b94a7b1f15fd6a143442e11e321be16293e')
  AND EXISTS (SELECT 1 FROM fin_komite_rapbm_versions WHERE version_id='b18f2231-995c-4ea5-b3cc-de9b73076ff7' AND cohort=2026 AND enabled=0 AND previous_version_id IS NULL)
  AND (SELECT COUNT(*) FROM fin_komite_rapbm_versions WHERE cohort=2026)=1
  AND NOT EXISTS (SELECT 1 FROM fin_komite_allocations a JOIN fin_rapbm_groups g ON g.id=a.group_id WHERE g.version_id='b18f2231-995c-4ea5-b3cc-de9b73076ff7')
);

DROP TRIGGER IF EXISTS rapbm_items_no_delete;
DROP TRIGGER IF EXISTS rapbm_groups_no_delete;
DROP TRIGGER IF EXISTS rapbm_version_no_delete;

UPDATE fin_rapbm_years SET active_version_id=NULL WHERE year=2026 AND active_version_id='b18f2231-995c-4ea5-b3cc-de9b73076ff7';
DELETE FROM fin_komite_budget_positions WHERE group_id IN (SELECT id FROM fin_rapbm_groups WHERE version_id='b18f2231-995c-4ea5-b3cc-de9b73076ff7');
DELETE FROM fin_komite_rapbm_versions WHERE version_id='b18f2231-995c-4ea5-b3cc-de9b73076ff7' AND enabled=0;
DELETE FROM fin_rapbm_items WHERE group_id IN (SELECT id FROM fin_rapbm_groups WHERE version_id='b18f2231-995c-4ea5-b3cc-de9b73076ff7');
DELETE FROM fin_rapbm_groups WHERE version_id='b18f2231-995c-4ea5-b3cc-de9b73076ff7';
DELETE FROM fin_rapbm_versions WHERE id='b18f2231-995c-4ea5-b3cc-de9b73076ff7';

CREATE TRIGGER IF NOT EXISTS rapbm_version_no_delete BEFORE DELETE ON fin_rapbm_versions
    BEGIN SELECT RAISE(ABORT,'Arsip RAPBM tidak boleh dihapus'); END;
CREATE TRIGGER IF NOT EXISTS rapbm_groups_no_delete BEFORE DELETE ON fin_rapbm_groups BEGIN SELECT RAISE(ABORT,'Rincian RAPBM tidak boleh dihapus'); END;
CREATE TRIGGER IF NOT EXISTS rapbm_items_no_delete BEFORE DELETE ON fin_rapbm_items BEGIN SELECT RAISE(ABORT,'Rincian RAPBM tidak boleh dihapus'); END;

INSERT INTO fin_rapbm_versions (id,year,version,status,title,institution,sheet,income_totals_json,expense_totals_json,notes_json,original_filename,r2_key,source_sha256,created_by,created_by_name,komite_cohort)
VALUES ('c26a2026-1125-4e60-95a8-63ce80123b4b',2026,1,'draft','RENCANA  ANGGARAN  PENDAPATAN DAN BELANJA  MADRASAH ( RAPBM )','MADRASAH  ALIYAH  NEGERI  1  TASIKMALAYA','RAPBM 2026','{"apbn":2443436000,"komite":2223000000,"total":4666436000}','{"apbn":2454236000,"komite":2212200000,"total":4666436000}','[{"reference":"RAPBM 2026!J31","message":"Subtotal Belanja Keperluan Perkantoran (Jumlah) berbeda dari rincian.","source":715413000,"calculated":719613000},{"reference":"RAPBM 2026!J66","message":"Subtotal Belanja Honor Output Kegiatan (Jumlah) berbeda dari rincian.","source":101900000,"calculated":189260000},{"reference":"RAPBM 2026!J124","message":"Mebeleuir 2 ruang kelas: jumlah berbeda atau kosong dibanding APBN + Komite.","source":null,"calculated":115200000},{"reference":"RAPBM 2026!J130","message":"Subtotal Belanja Modal Peralatan dan Mesin (Jumlah) berbeda dari rincian.","source":651000000,"calculated":535800000},{"reference":"RAPBM 2026!J166","message":"Total belanja keseluruhan berbeda dari penjumlahan rincian.","source":4666436000,"calculated":4551236000}]','RAPBM 2026.xlsx','private/rapbm/2026/c26a2026-1125-4e60-95a8-63ce80123b4b.xlsx','63ce80123b4b2dff0cc8cbc5ca0d0b48f57f2c25f4e7515fcee694cb97eb0505',(SELECT id FROM "user" WHERE id='dd3f7cfea48304d777433295a671c3db'),'M. Iqbal Abdul Wakil, M.Pd.',2026);

INSERT INTO fin_rapbm_groups (id,version_id,section,sort_order,label,account,source_ref,subtotal_ref,apbn,komite,total) VALUES
  ('b36c5d54-2bc4-4da4-a45b-e9fb9ddce95e','c26a2026-1125-4e60-95a8-63ce80123b4b','income',1,'APBN',NULL,'RAPBM 2026!B9:J9','RAPBM 2026!H12:H12',2443436000,NULL,2443436000),
  ('99499918-976a-4818-a063-e1c88d263821','c26a2026-1125-4e60-95a8-63ce80123b4b','income',2,'KOMITE MADRASAH',NULL,'RAPBM 2026!B13:J13','RAPBM 2026!H15:H15',NULL,2223000000,2223000000),
  ('16223cfa-6528-4f61-abd8-c79b1bc08cd4','c26a2026-1125-4e60-95a8-63ce80123b4b','expense',1,'Belanja Keperluan Perkantoran','521111','RAPBM 2026!B22:J22','RAPBM 2026!H31:J31',343293000,376320000,715413000),
  ('4ac0788e-186e-4d37-ae48-ca4a5d7b789e','c26a2026-1125-4e60-95a8-63ce80123b4b','expense',2,'Belanja Bahan','521211','RAPBM 2026!B33:J33','RAPBM 2026!H50:J50',171512000,5040000,176552000),
  ('1ae9e23f-7c56-44f3-ad69-c9f29ee7ef4e','c26a2026-1125-4e60-95a8-63ce80123b4b','expense',3,'Belanja Honor Output Kegiatan','521213','RAPBM 2026!B51:J51','RAPBM 2026!H66:J66',87360000,101900000,101900000),
  ('e65702e3-adc6-488f-a1bc-3746453f28ed','c26a2026-1125-4e60-95a8-63ce80123b4b','expense',4,'Belanja Barang Non Operasional Lainnya','521219','RAPBM 2026!B67:J67','RAPBM 2026!H81:J81',341979000,41040000,383019000),
  ('cb11e58d-c7d9-44d4-adf3-e7b1f9e4f9f2','c26a2026-1125-4e60-95a8-63ce80123b4b','expense',5,'Belanja Barang Persediaan Barang Konsumsi','521811','RAPBM 2026!B82:J82','RAPBM 2026!H87:J87',44500000,15480000,59980000),
  ('bf11cc8b-a19d-4a68-a5d6-598d6dbaafd0','c26a2026-1125-4e60-95a8-63ce80123b4b','expense',6,'Belanja Sewa','522141','RAPBM 2026!B89:J89','RAPBM 2026!H96:J96',5000000,325440000,330440000),
  ('1b3866cb-0836-4b13-a36c-121acc06a6b7','c26a2026-1125-4e60-95a8-63ce80123b4b','expense',7,'Belanja Pemeliharaan Gedung dan Bangunan','523111','RAPBM 2026!B97:J97','RAPBM 2026!H101:J101',451500000,53200000,504700000),
  ('cdb12762-b079-48b1-ad41-a6b19279ec42','c26a2026-1125-4e60-95a8-63ce80123b4b','expense',8,'Belanja Pengembangan Sarana dan Prasarana',NULL,'RAPBM 2026!B102:J102','RAPBM 2026!H107:J107',23856000,353000000,376856000),
  ('44bdd699-80b7-4bfd-ae12-995e36c33df3','c26a2026-1125-4e60-95a8-63ce80123b4b','expense',9,'Belanja Pemeliharaan Peralatan dan Mesin','523121','RAPBM 2026!B108:J108','RAPBM 2026!H111:J111',24832000,36000000,60832000),
  ('f091bd60-31bc-4274-a0df-e5dd77a45f70','c26a2026-1125-4e60-95a8-63ce80123b4b','expense',10,'Belanja Perjalanan Dinas Biasa','524111','RAPBM 2026!B112:J112','RAPBM 2026!H116:J116',80000000,260000000,340000000),
  ('ac34da0a-b942-4106-a9d8-3189cd893122','c26a2026-1125-4e60-95a8-63ce80123b4b','expense',11,'Belanja Perjalanan Dinas Dalam Kota','524113','RAPBM 2026!B117:J117','RAPBM 2026!H120:J120',143000000,0,143000000),
  ('04099f2e-e051-44f4-abe9-a91d01538fa3','c26a2026-1125-4e60-95a8-63ce80123b4b','expense',12,'Belanja Modal Peralatan dan Mesin','532111','RAPBM 2026!B121:J121','RAPBM 2026!H130:J130',388800000,262200000,651000000),
  ('de01c3d4-c3ae-4cd9-ac53-5c74107f04ab','c26a2026-1125-4e60-95a8-63ce80123b4b','expense',13,'Belanja Modal Lainnya','536111','RAPBM 2026!B131:J131','RAPBM 2026!H135:J135',76000000,10000000,86000000),
  ('00b1e698-bfce-4149-a251-0403b5ef94c3','c26a2026-1125-4e60-95a8-63ce80123b4b','expense',14,'Belanja Keperluan Perkantoran','521111','RAPBM 2026!B136:J136','RAPBM 2026!H139:J139',10700000,0,10700000),
  ('6aa3ce33-671c-41ac-a049-f54fddf7aeaf','c26a2026-1125-4e60-95a8-63ce80123b4b','expense',15,'Belanja Honor Operasional Satuan Kerja','521115','RAPBM 2026!B140:J140','RAPBM 2026!H146:J146',47040000,0,47040000),
  ('69eea465-e3fb-4df0-abb5-4b8b841b93d2','c26a2026-1125-4e60-95a8-63ce80123b4b','expense',17,'Belanja langganan dan Jasa',NULL,'RAPBM 2026!B147:J147','RAPBM 2026!H151:J151',111402000,0,111402000),
  ('26ec38e5-156b-4bfb-a724-73dd623253ae','c26a2026-1125-4e60-95a8-63ce80123b4b','expense',18,'Lain - lain',NULL,'RAPBM 2026!B152:J152','RAPBM 2026!H165:J165',103462000,372580000,476042000);

INSERT INTO fin_rapbm_items (id,group_id,sort_order,description,account,volume,unit,source_ref,apbn,komite,total) VALUES
  ('ee75eb18-341b-45f3-ae11-38e68a154e1b','b36c5d54-2bc4-4da4-a45b-e9fb9ddce95e',1,'BOS (1676 X Rp. 1.500.000,-)',NULL,'12','Bln','RAPBM 2026!D10:J10',2312471000,NULL,2312471000),
  ('482e1e28-22a2-45cf-a947-f4b62d87445f','b36c5d54-2bc4-4da4-a45b-e9fb9ddce95e',2,'PROGRAM DUKUNGAN MANAJEMEN',NULL,'12','Bln','RAPBM 2026!D11:J11',130965000,NULL,130965000),
  ('c43dbf08-dc51-443c-a51e-1f7c05c2fd64','99499918-976a-4818-a063-e1c88d263821',1,'Estimasi Sumbangan Sukarela orangatua',NULL,'684','siswa','RAPBM 2026!D14:J14',NULL,2223000000,2223000000),
  ('a70f96d3-610e-41ec-a907-56982e22931c','16223cfa-6528-4f61-abd8-c79b1bc08cd4',1,'1. Belanja Internet','521111','12','Bulan','RAPBM 2026!E23:J23',46440000,0,46440000),
  ('808bf0b5-1269-4d02-ad49-b33d570a58d0','16223cfa-6528-4f61-abd8-c79b1bc08cd4',2,'2. Belanja Honor Satpam  Non PNS (4 Orang','521111','13','Bulan','RAPBM 2026!E24:J24',146853000,0,146853000),
  ('532e16a5-39a4-4ad5-af7c-be05534c6c1d','16223cfa-6528-4f61-abd8-c79b1bc08cd4',3,'3. Belanja Honor Guru Non PNS  7 orang dengan jumlah KJM','521111','13','Bulan','RAPBM 2026!E25:J25',NULL,254280000,254280000),
  ('a4084b66-4775-452b-a6a8-1033ed8cc58c','16223cfa-6528-4f61-abd8-c79b1bc08cd4',4,'4.  Belanja Barang/Kebutuhan Kelas','521111','1','thn','RAPBM 2026!E26:J26',150000000,0,150000000),
  ('5fa3900b-bb45-4cc7-acd6-542ab459da18','16223cfa-6528-4f61-abd8-c79b1bc08cd4',5,'5. Belanja honor pelatih ekstra kurikuler','521111','1','thn','RAPBM 2026!E27:J27',NULL,48000000,48000000),
  ('e1b130d3-ee06-4033-a232-cd7a433cc36a','16223cfa-6528-4f61-abd8-c79b1bc08cd4',6,'6. belanja developing Mansatas App','521111','1','thn','RAPBM 2026!E28:J28',NULL,62640000,62640000),
  ('47bf66c0-7789-43f5-aaf3-1876b9be5193','16223cfa-6528-4f61-abd8-c79b1bc08cd4',7,'7. Belanja Langganan layanan aplikasi editing, media sosial pro','521111','1','thn','RAPBM 2026!E29:J29',NULL,7200000,7200000),
  ('b1e042b1-ebf2-4b3a-a831-5fb9c390ff99','16223cfa-6528-4f61-abd8-c79b1bc08cd4',8,'8. Belanja hosting website','521111','1','thn','RAPBM 2026!E30:J30',NULL,4200000,4200000),
  ('e4a51549-900a-4dac-a859-cd4d584fd65c','4ac0788e-186e-4d37-ae48-ca4a5d7b789e',1,'1. Belanja ATK Kegiatan PPDB','521211','50','Buah','RAPBM 2026!E34:J34',22500000,0,22500000),
  ('d502c42a-596f-4c80-a596-224d06030eb0','4ac0788e-186e-4d37-ae48-ca4a5d7b789e',2,'2.Belanja Konsumsi Kegiatan  PPDB (40 Orang x 15 Hr)','521211','600','OH','RAPBM 2026!E35:J35',10500000,NULL,10500000),
  ('be7c3594-b584-4540-a409-8a860d6f4903','4ac0788e-186e-4d37-ae48-ca4a5d7b789e',3,'3.Belanja Konsumsi Matsama (40 Orang x 6 Hr','521211','720','OH','RAPBM 2026!E36:J36',12600000,NULL,12600000),
  ('3175f6a1-c58b-432c-a25c-9d72c84c2a7a','4ac0788e-186e-4d37-ae48-ca4a5d7b789e',4,'4. Belanja Konsumsi ASAS (60 Orang x 12 Hr)','521211','720','OH','RAPBM 2026!E37:J37',12600000,NULL,12600000),
  ('b941c7c7-af20-4cb6-acb1-bb8bc9ecbbbb','4ac0788e-186e-4d37-ae48-ca4a5d7b789e',5,'5. Belanja Konsumsi Kegiatan ASAT ( 60 Orang x 12 Hr )','521211','720','OH','RAPBM 2026!E38:J38',12600000,NULL,12600000),
  ('5085ade2-dadf-41ef-a494-19592d188feb','4ac0788e-186e-4d37-ae48-ca4a5d7b789e',6,'6. Belanja Konsumsi Kegiatan Ujian Madrasah (40 Orang x 12 Hr)','521211','480','OH','RAPBM 2026!E39:J39',8400000,NULL,8400000),
  ('882818a2-91ab-457a-aca0-0dbb591bc951','4ac0788e-186e-4d37-ae48-ca4a5d7b789e',7,'7. Belanja ATK Kegiatan  Perlombaan Antar Kelas','521211','350','Buah','RAPBM 2026!E40:J40',17500000,NULL,17500000),
  ('21f6360c-8844-40b3-afd1-19a62a1c77d6','4ac0788e-186e-4d37-ae48-ca4a5d7b789e',8,'8. Belanja  Konsumsi  Kegiatan Perlombaan Antar Kelas (150 Orang x 6 Kelas)','521211','900','OH','RAPBM 2026!E41:J41',15750000,NULL,15750000),
  ('a352177f-ad20-42c6-ad59-8fe1cbdcd396','4ac0788e-186e-4d37-ae48-ca4a5d7b789e',9,'9. Belanja Konsumsi Kegiatan ExtraKurikuler 75 Or x 45 Keg )','521211','3375','OH','RAPBM 2026!E42:J42',59062000,NULL,59062000),
  ('47bf7369-b594-4b8d-ae19-a5f0945f75cd','4ac0788e-186e-4d37-ae48-ca4a5d7b789e',10,'10. Belanja Konsumsi Kegiatan Test  Kemampuan Akademik (40 Or x 6 Hr)','521211','240','OH','RAPBM 2026!E43:J43',0,NULL,0),
  ('3a845977-609d-4e95-a9c0-cf4f50ebdbe2','4ac0788e-186e-4d37-ae48-ca4a5d7b789e',11,'11. Belanja konsumsi Rapat Konsultasi dan Kordinasi','521211','48','Keg','RAPBM 2026!E44:J44',0,NULL,0),
  ('89e3add7-2436-40d3-a9e9-ac21f9b78cdc','4ac0788e-186e-4d37-ae48-ca4a5d7b789e',12,'12. Belanja Konsumsi kebutuhan Dapur Madrasah','521211','24','Keg','RAPBM 2026!E45:J45',0,NULL,0),
  ('0ac8b774-a64b-4177-ad3f-4754db77252d','4ac0788e-186e-4d37-ae48-ca4a5d7b789e',13,'13. Belanja konsumsi kegiatan PHBI dan PHBN','521211',NULL,NULL,'RAPBM 2026!E46:J46',NULL,NULL,0),
  ('c9aec471-1025-41eb-a67b-a1a0d4e1b7ad','4ac0788e-186e-4d37-ae48-ca4a5d7b789e',14,'14. Belanja konsumsi pemateri dan Dewan juri kegiatan PHBI / PHBN','521211','5','Keg','RAPBM 2026!E47:J47',NULL,840000,840000);
INSERT INTO fin_rapbm_items (id,group_id,sort_order,description,account,volume,unit,source_ref,apbn,komite,total) VALUES
  ('a85da515-0fbf-451c-a5e3-a09fea065eab','4ac0788e-186e-4d37-ae48-ca4a5d7b789e',15,'15. Belanja konsumsi kegiatan PHBI/ PHBN','521211','240','OH','RAPBM 2026!E48:J48',NULL,4200000,4200000),
  ('7b8b4411-a449-418c-a00c-7dd1035eaae8','1ae9e23f-7c56-44f3-ad69-c9f29ee7ef4e',1,'1. Honor Panitia PPDB','521213','30','OH','RAPBM 2026!E52:J52',22400000,0,22400000),
  ('612f3307-c3b7-4cde-a4d9-ccc3242fc33c','1ae9e23f-7c56-44f3-ad69-c9f29ee7ef4e',2,'2. Honor Panitia Matamuda','521213','40','OH','RAPBM 2026!E53:J53',12000000,0,12000000),
  ('ea8d9e2b-09f5-4c5f-a3fa-034d655a54ef','1ae9e23f-7c56-44f3-ad69-c9f29ee7ef4e',3,'3. Honor Panitia, Pengawas Ujian Madrasah','521213','200','OH','RAPBM 2026!E54:J54',24960000,0,24960000),
  ('22da8a3e-56fc-423b-af86-49ca188f4959','1ae9e23f-7c56-44f3-ad69-c9f29ee7ef4e',4,'4. Honor Panitia ASAS','521213','40','OH','RAPBM 2026!E55:J55',12000000,0,12000000),
  ('f5f33f51-6951-4499-ae41-2207020d12e2','1ae9e23f-7c56-44f3-ad69-c9f29ee7ef4e',5,'5. Honor Panitia ASAT','521213','36','OH','RAPBM 2026!E56:J56',10800000,0,10800000),
  ('9649d2e9-4143-4688-a18a-9230d68f9528','1ae9e23f-7c56-44f3-ad69-c9f29ee7ef4e',6,'6. Honor Pembuatan Naskah Ujian','521213','26','OH','RAPBM 2026!E57:J57',5200000,0,5200000),
  ('1e2650f5-1dd0-4c99-ac66-d9c2ddae0d25','1ae9e23f-7c56-44f3-ad69-c9f29ee7ef4e',7,'7. Honor Panitia TKA','521213','40','OH','RAPBM 2026!E58:J58',NULL,NULL,0),
  ('ab89959b-aed5-4519-a0bb-0eff3c83dd5b','1ae9e23f-7c56-44f3-ad69-c9f29ee7ef4e',8,'8. Honor Panitia dan Pemateri PHBI','521213','3','Keg','RAPBM 2026!E59:J59',NULL,7500000,7500000),
  ('e85745db-46ab-40db-aca5-65d69d787189','1ae9e23f-7c56-44f3-ad69-c9f29ee7ef4e',9,'9. Honor Dewan Juri PHBN','521213','6','Lomba','RAPBM 2026!E60:J60',NULL,4800000,4800000),
  ('172ebfae-38e8-4999-a3f6-c49b12c2e0f6','1ae9e23f-7c56-44f3-ad69-c9f29ee7ef4e',10,'10. Honor Panitia dan penguji munaqasah Tahfidz','521213','40','OK','RAPBM 2026!E61:J61',NULL,16000000,16000000),
  ('79522e88-c9d4-4842-a3bf-094491fe932f','1ae9e23f-7c56-44f3-ad69-c9f29ee7ef4e',11,'11. Honor Panitia In House Training murid','521213','4','keg','RAPBM 2026!E62:J62',NULL,16000000,16000000),
  ('67403676-3e67-4c46-a23b-be957ad35b0b','1ae9e23f-7c56-44f3-ad69-c9f29ee7ef4e',12,'12. Honor Kegiatan Akselari Madrasah Unggul','521213',NULL,NULL,'RAPBM 2026!E63:J63',NULL,NULL,0),
  ('acfe4202-a5cc-460f-a7bb-0e79dabadf2a','1ae9e23f-7c56-44f3-ad69-c9f29ee7ef4e',13,'12. Honorarium kegiatan Pra olimpiade Nasional dan Internasional 9 Mata pelajaran','521213','3','tingkat','RAPBM 2026!E64:J64',NULL,57600000,57600000),
  ('74ce3919-3ffe-4f8a-aee7-f8212127dfe7','e65702e3-adc6-488f-a1bc-3746453f28ed',1,'1. Penggandaan Naskah Soal ASAS','521219','1676','Siswa','RAPBM 2026!E68:J68',87152000,0,87152000),
  ('4671d7d9-fc4f-4031-a7bf-978425facb6e','e65702e3-adc6-488f-a1bc-3746453f28ed',2,'2. Belanja Pengadaan Kertas Raport','521219','40','Rim','RAPBM 2026!E69:J69',7000000,0,7000000),
  ('5d6abcd7-7e15-4b72-a03e-7ea15e76331e','e65702e3-adc6-488f-a1bc-3746453f28ed',3,'3. Belanja Penggandaan Naskah  Soal ASAT','521219','1230','Siswa','RAPBM 2026!E70:J70',63960000,0,63960000),
  ('f62b54c9-9548-4cba-a8de-05387517ec9b','e65702e3-adc6-488f-a1bc-3746453f28ed',4,'4. Belanja Penggandaan Naskah Ujian Madrasah','521219','446','Siswa','RAPBM 2026!E71:J71',23664000,0,23664000),
  ('1a8e16d0-ebcd-430c-afcc-b13e02e3c3a7','e65702e3-adc6-488f-a1bc-3746453f28ed',5,'5. Pendaftaran Kegiatan Lomba','521219','100','OK','RAPBM 2026!E72:J72',25000000,0,25000000),
  ('e05af7fc-ead1-4970-ab50-60a82740bda7','e65702e3-adc6-488f-a1bc-3746453f28ed',6,'6. Alat Penunjang Kegiatan Extrakurikuler','521219','1','Kegiatan','RAPBM 2026!E73:J73',43289000,0,43289000),
  ('31405196-7d18-4aae-a06e-db35df43e32f','e65702e3-adc6-488f-a1bc-3746453f28ed',7,'7. Belanja Pengadaan Kegiatan Extra dan Intrakulikuler','521219','500','Keg','RAPBM 2026!E74:J74',37500000,0,37500000),
  ('2864f82c-b28f-4483-ad10-18ef5b94f525','e65702e3-adc6-488f-a1bc-3746453f28ed',8,'8. Belanja Sampul Raort','521219','684','Siswa','RAPBM 2026!E75:J75',34344000,0,34344000),
  ('d6e2e204-2fb1-44a6-a428-fdbb0e70d4e0','e65702e3-adc6-488f-a1bc-3746453f28ed',9,'9. Belanja Sampul Ijazah','521219','684','Siswa','RAPBM 2026!E76:J76',20070000,0,20070000),
  ('faef71c3-3793-4739-a5fb-7e1de71da1aa','e65702e3-adc6-488f-a1bc-3746453f28ed',10,'10. Belanja Penggandaan dokumen dan adminitrasi madrasah','521219','80','Keg','RAPBM 2026!E77:J77',0,NULL,0),
  ('7fa1982c-d6c9-4c56-a9ec-a9151b7417dc','e65702e3-adc6-488f-a1bc-3746453f28ed',11,'12. Belanja foto dan kartu pelajar','521219','684','Buah','RAPBM 2026!E78:J78',NULL,20520000,20520000);
INSERT INTO fin_rapbm_items (id,group_id,sort_order,description,account,volume,unit,source_ref,apbn,komite,total) VALUES
  ('01060c8d-f691-471a-ad0f-e9b743fe0a27','e65702e3-adc6-488f-a1bc-3746453f28ed',12,'13. Belanja pengadaan maqra'' tadarrus','521219','684','Buah','RAPBM 2026!E79:J79',NULL,10260000,10260000),
  ('984895df-6071-4ab1-aaa2-94193443b141','e65702e3-adc6-488f-a1bc-3746453f28ed',13,'14. Belanja pengadaan buku pribadi murid','521219','684','Buah','RAPBM 2026!E80:J80',NULL,10260000,10260000),
  ('70e999eb-109f-48fb-a12c-652264591d9f','cb11e58d-c7d9-44d4-adf3-e7b1f9e4f9f2',1,'1. Belanja Kegiatan Belajar Mengajar','521811','250','Buah','RAPBM 2026!E83:J83',33750000,0,33750000),
  ('70d12199-e125-4caf-ae09-98ec0fc86058','cb11e58d-c7d9-44d4-adf3-e7b1f9e4f9f2',2,'2. Belanja Penunjang Kegiatan Lainnya','521811','250','Rim','RAPBM 2026!E84:J84',10750000,0,10750000),
  ('1cb0f97d-ec15-461a-a4fe-ac7f906a95d6','cb11e58d-c7d9-44d4-adf3-e7b1f9e4f9f2',3,'4. Belanja Piala kegiatan lomba','521811','6','Set','RAPBM 2026!E85:J85',NULL,1800000,1800000),
  ('4332e388-36d6-49a1-ad6f-9fe4821350f9','cb11e58d-c7d9-44d4-adf3-e7b1f9e4f9f2',4,'5. Belanja medali dan sertifikat tahfidz','521811','684','buah','RAPBM 2026!E86:J86',NULL,13680000,13680000),
  ('8823864f-c190-4c8b-a258-bb22efcb85b4','bf11cc8b-a19d-4a68-a5d6-598d6dbaafd0',1,'1. Belanja Sewa Tempat Kegiatan Extra Kurikuler','522141','10','OK','RAPBM 2026!E90:J90',2500000,NULL,2500000),
  ('00403704-eebf-4f33-a5d0-42d6ca7bdd56','bf11cc8b-a19d-4a68-a5d6-598d6dbaafd0',2,'2. Belanja Sewa Perlengkapan  Lomba','522141','10','OK','RAPBM 2026!E91:J91',2500000,NULL,2500000),
  ('82c4aff4-5c6a-47be-a22c-734f70736795','bf11cc8b-a19d-4a68-a5d6-598d6dbaafd0',3,'3. Belanja jasa psikotes siswa Kelas X','522141','684','Or','RAPBM 2026!E92:J92',NULL,115200000,115200000),
  ('4fae0abf-2f09-4d17-ac7c-f6d5153ea378','bf11cc8b-a19d-4a68-a5d6-598d6dbaafd0',4,'4. Belanja sewa panggung kegiatan 4 x 6','522141','5','Keg','RAPBM 2026!E93:J93',NULL,3600000,3600000),
  ('29ca0754-0aeb-4229-af59-69ea408fe32b','bf11cc8b-a19d-4a68-a5d6-598d6dbaafd0',5,'5. Belanja Sewa panggung 6 x 8','522141','1','keg','RAPBM 2026!E94:J94',NULL,1440000,1440000),
  ('69136c53-195f-4286-a1d3-0bd26676b6f2','bf11cc8b-a19d-4a68-a5d6-598d6dbaafd0',6,'6. Belanja jasa pelatihan bilingual kursus (UNGGULAN)','522141','6','keg','RAPBM 2026!E95:J95',NULL,205200000,205200000),
  ('d4991bac-7840-44ac-a1d1-d6e5e755d787','1b3866cb-0836-4b13-a36c-121acc06a6b7',1,'1. Belanja Perbaikan/ Pemeliharaan Ruang Wakamad, WC dan Kusen Kelas','523111','1103','M3','RAPBM 2026!E98:J98',320645000,0,320645000),
  ('f60443e8-36f2-4dcd-aa01-eb5a6658387e','1b3866cb-0836-4b13-a36c-121acc06a6b7',2,'2. Belanja Perbaikan Halaman/ Pemeliharaan Gedung Bangunan Pendidikan dan Lainnya','523111','1645','M3','RAPBM 2026!E99:J99',130855000,0,130855000),
  ('0b2612df-2352-4605-ab1b-8ea690729e87','1b3866cb-0836-4b13-a36c-121acc06a6b7',3,'3. Rehabilitasi  Mesjid','523111','1250','M2','RAPBM 2026!E100:J100',NULL,53200000,53200000),
  ('a5721c2a-43fb-45de-a415-93116cdbb4c7','cdb12762-b079-48b1-ad41-a6b19279ec42',1,'a. Belanja Pemeliharaan Gedung Pendidikan',NULL,'223','M3','RAPBM 2026!E103:J103',23856000,76500000,100356000),
  ('c38576f9-a303-49b8-a0fa-bb593cb1ac35','cdb12762-b079-48b1-ad41-a6b19279ec42',2,'b. Renovasi ruang prakarya dan peralatan',NULL,'1','unit','RAPBM 2026!E104:J104',NULL,91300000,91300000),
  ('99156398-6267-4676-a461-c5215fd23744','cdb12762-b079-48b1-ad41-a6b19279ec42',3,'c. Renovasi ruang auditorium (ex Ruang Perpustakaan)',NULL,'316','M3','RAPBM 2026!E105:J105',NULL,142200000,142200000),
  ('43224473-5f5d-4522-abdd-17df9d68ebc1','cdb12762-b079-48b1-ad41-a6b19279ec42',4,'Belanja Becak motor',NULL,'1','unit','RAPBM 2026!E106:J106',NULL,43000000,43000000),
  ('d353f83b-9b25-40ce-ad5a-413422942338','44bdd699-80b7-4bfd-ae12-995e36c33df3',1,'Perbaikan peralatan dan mesin','523121','30','Unit','RAPBM 2026!E109:J109',22500000,12000000,34500000),
  ('676b97c2-a519-4790-a598-64212c58beec','44bdd699-80b7-4bfd-ae12-995e36c33df3',2,'Pemeliharaan Inventaris Kantor','523121','5','Unit','RAPBM 2026!E110:J110',2332000,24000000,26332000),
  ('bfc2dbbf-4d0d-47db-afea-3a1a91fe83a9','f091bd60-31bc-4274-a0df-e5dd77a45f70',1,'Belanja  persiapan Lomba, Pengembangan diri,  Koordinasi dan Konsultasi','524111','350','OK','RAPBM 2026!E113:J113',80000000,65000000,145000000),
  ('35b9d59e-f183-403e-aacb-3d39dd2cf0aa','f091bd60-31bc-4274-a0df-e5dd77a45f70',2,'Belanja transport home visit dan kunjungan lainnya','524111','600','Oh','RAPBM 2026!E114:J114',NULL,60000000,60000000),
  ('b8ade72d-6cf7-47b5-a493-69d28815671f','f091bd60-31bc-4274-a0df-e5dd77a45f70',3,'Belanja Mobilisasi kegiatan peningkatan mutu murid','524111','30','Keg','RAPBM 2026!E115:J115',NULL,135000000,135000000),
  ('0aa3fda5-45e0-4d59-ac5b-950857c29382','ac34da0a-b942-4106-a9d8-3189cd893122',1,'Belanja Tranport Mengikuti Lomba (20 KEG X 30 ORG)','524113','700','Oh','RAPBM 2026!E118:J118',105000000,NULL,105000000);
INSERT INTO fin_rapbm_items (id,group_id,sort_order,description,account,volume,unit,source_ref,apbn,komite,total) VALUES
  ('79fc54e7-1d8e-4eed-a7a9-4fab7267435b','ac34da0a-b942-4106-a9d8-3189cd893122',2,'konsultasi dan koordinasi','524113','72','Oh','RAPBM 2026!E119:J119',38000000,NULL,38000000),
  ('8d0508b7-c2d2-4d90-afaf-457a39c0294d','04099f2e-e051-44f4-abe9-a91d01538fa3',1,'CCTV Wireless','532111','25','Unit','RAPBM 2026!E122:J122',37500000,0,37500000),
  ('940b0057-f55d-440b-a550-8b5ab23d0950','04099f2e-e051-44f4-abe9-a91d01538fa3',2,'PC, Laptop,  dan Perlatan Mesin Lainnya','532111','25','Unit','RAPBM 2026!E123:J123',236100000,0,236100000),
  ('ca2ebaed-4cb1-4193-ae07-38eff4dd24ff','04099f2e-e051-44f4-abe9-a91d01538fa3',3,'Mebeleuir 2 ruang kelas','532111','72','set','RAPBM 2026!E124:J124',115200000,NULL,NULL),
  ('507160a6-7f62-4992-a0ac-b9225cfa1c84','04099f2e-e051-44f4-abe9-a91d01538fa3',4,'Sound System','532111','1','Unit','RAPBM 2026!E125:J125',NULL,0,0),
  ('2ac60286-1575-42e3-add3-d1b99cdaca55','04099f2e-e051-44f4-abe9-a91d01538fa3',5,'Smart TV 52','532111','8','Unit','RAPBM 2026!E126:J126',NULL,0,0),
  ('4839ca64-9f14-43ee-adee-34cf83c55f49','04099f2e-e051-44f4-abe9-a91d01538fa3',6,'Pengadaan bahan dan sewa alat riset','532111','8','Keg','RAPBM 2026!E127:J127',NULL,66000000,66000000),
  ('9e94ef6e-d86e-4a86-a48b-26db09c0af1f','04099f2e-e051-44f4-abe9-a91d01538fa3',7,'Perlengkapan All in one PC','532111','10','set','RAPBM 2026!E128:J128',NULL,148000000,148000000),
  ('7c2fd4eb-3b14-4f86-aa91-38c9c60cee6c','04099f2e-e051-44f4-abe9-a91d01538fa3',8,'Perlengkapan Desain Komunikasi Visual (DKV)','532111','2','unit','RAPBM 2026!E129:J129',NULL,48200000,48200000),
  ('0dc67ada-ae05-4467-a380-8899484b168c','de01c3d4-c3ae-4cd9-ac53-5c74107f04ab',1,'Belanja Pengadaan Buku Utama','536111','800','Eks','RAPBM 2026!E132:J132',76000000,0,76000000),
  ('6adba15d-8506-4eb8-aae6-aab67e9ba897','de01c3d4-c3ae-4cd9-ac53-5c74107f04ab',2,'Belanja bibit tanaman/ Adiwiyata','536111','1','paket','RAPBM 2026!E133:J133',NULL,10000000,10000000),
  ('e67f8067-426d-487f-aa89-4786302891f2','00b1e698-bfce-4149-a251-0403b5ef94c3',1,'Biaya Admin Transfer','521111','12','Bln','RAPBM 2026!E137:J137',1200000,0,1200000),
  ('c4a72aaf-368e-41c0-a012-8c28d66c97d3','00b1e698-bfce-4149-a251-0403b5ef94c3',2,'Biaya kebutuhan kantor lainnya','521111','25','Bln','RAPBM 2026!E138:J138',9500000,0,9500000),
  ('106fac63-91e9-4b23-a5e6-009831fea54b','6aa3ce33-671c-41ac-a049-f54fddf7aeaf',1,'Honor Kuasa Pengguna Anggaran','521115','12','Bln','RAPBM 2026!E141:J141',16440000,0,16440000),
  ('e9dba396-bf5e-445e-ad63-9deb7504d959','6aa3ce33-671c-41ac-a049-f54fddf7aeaf',2,'Honor Pejabat Pembuat Komitmen','521115','12','Bln','RAPBM 2026!E142:J142',13800000,0,13800000),
  ('0155994a-4ff0-4b82-a973-c758f87737e3','6aa3ce33-671c-41ac-a049-f54fddf7aeaf',3,'Honor Bendahara Pengeluaran','521115','12','Bln','RAPBM 2026!E143:J143',5640000,0,5640000),
  ('8aca93f1-1246-405f-ad6b-18924ed8d557','6aa3ce33-671c-41ac-a049-f54fddf7aeaf',4,'Honor PPSPM','521115','12','Bln','RAPBM 2026!E144:J144',6360000,0,6360000),
  ('43cd196d-7c38-47b0-a9ff-2b0292f51166','6aa3ce33-671c-41ac-a049-f54fddf7aeaf',5,'Honor Pejabat Pengadaan','521115','12','Bln','RAPBM 2026!E145:J145',4800000,0,4800000),
  ('592c1080-ec60-4c88-a6ed-9f46acffa6f6','69eea465-e3fb-4df0-abb5-4b8b841b93d2',1,'Langganan Listrik','522111','12','Bln','RAPBM 2026!E148:J148',68437000,0,68437000),
  ('4b2259e8-1986-4881-ab8d-681d1cb91d29','69eea465-e3fb-4df0-abb5-4b8b841b93d2',2,'Internet','522112','12','Bln','RAPBM 2026!E149:J149',42965000,0,42965000),
  ('95d0e769-921a-4cb5-a67a-23ee423dcc90','69eea465-e3fb-4df0-abb5-4b8b841b93d2',3,'PADAM / Air','522113','12','Bln','RAPBM 2026!E150:J150',0,0,0),
  ('ccca8ec2-ec5d-45c9-a673-a116058fda4e','26ec38e5-156b-4bfb-a724-73dd623253ae',1,'Kegiatan Ko kurikuler dan Ajang Kreasi dan Seni Siswa',NULL,'12','Keg','RAPBM 2026!E153:J153',0,36000000,36000000),
  ('7ce3234e-d232-4d65-a7bd-f30afc6bc893','26ec38e5-156b-4bfb-a724-73dd623253ae',2,'Peningkatan kompetensi Pendidik dan tenaga kependidikan',NULL,'12','Bln','RAPBM 2026!E154:J154',64662000,12000000,76662000),
  ('9ab6c813-2ede-44ed-ae43-e59847e4b81d','26ec38e5-156b-4bfb-a724-73dd623253ae',3,'Jaminan prestasi Siswa dan pembimbing',NULL,'150','Or','RAPBM 2026!E155:J155',0,45000000,45000000),
  ('eba7341f-6b5b-4911-a69d-70914981ad60','26ec38e5-156b-4bfb-a724-73dd623253ae',4,'Kegiatan Pembinaan Keagamaan Madrasah',NULL,'6','Keg','RAPBM 2026!E156:J156',NULL,48000000,48000000);
INSERT INTO fin_rapbm_items (id,group_id,sort_order,description,account,volume,unit,source_ref,apbn,komite,total) VALUES
  ('c8dc4d7e-b219-4c87-ab19-62b6d826e4cf','26ec38e5-156b-4bfb-a724-73dd623253ae',5,'Image Building Madrasah',NULL,'12','Bln','RAPBM 2026!E157:J157',0,NULL,0),
  ('263c2415-afb2-4fde-a067-5304fdc9cadb','26ec38e5-156b-4bfb-a724-73dd623253ae',6,'a. Mansatas Islamic Fest',NULL,'1','Keg','RAPBM 2026!E158:J158',NULL,64000000,64000000),
  ('d4d2c140-3ff5-4e69-aea1-839facb3ac0c','26ec38e5-156b-4bfb-a724-73dd623253ae',7,'b. Pengembangan Program Jurusan Agama',NULL,'6','Keg','RAPBM 2026!E159:J159',NULL,38600000,38600000),
  ('1b328dd4-18db-42f9-abf2-df80cdb96ad7','26ec38e5-156b-4bfb-a724-73dd623253ae',8,'Pengembangan Standar pengelolaan dan Komptensi lulusan',NULL,'12','Bln','RAPBM 2026!E160:J160',28000000,44680000,72680000),
  ('ef61a74b-2d71-46a4-a9e0-32ef00c157ce','26ec38e5-156b-4bfb-a724-73dd623253ae',9,'Belanja langganan surat kabar',NULL,'12','Bln','RAPBM 2026!E161:J161',1200000,NULL,1200000),
  ('0b3def07-b561-44d2-a071-b145a9ac37f6','26ec38e5-156b-4bfb-a724-73dd623253ae',10,'Jamuan tamu madrasah',NULL,'12','Bln','RAPBM 2026!E162:J162',9600000,NULL,9600000),
  ('4729f0d0-8c2e-4bd2-ab6b-27b057031ad7','26ec38e5-156b-4bfb-a724-73dd623253ae',11,'Transportasi kegitan komite',NULL,'12','bln','RAPBM 2026!E163:J163',NULL,75300000,75300000),
  ('afc5e3e8-de5e-4f47-a6c5-c1a591994ba9','26ec38e5-156b-4bfb-a724-73dd623253ae',12,'Rapat penyusunan program kerja',NULL,'3','keg','RAPBM 2026!E164:J164',NULL,9000000,9000000);

UPDATE fin_rapbm_versions SET status='published',published_at=datetime('now'),published_by=(SELECT id FROM "user" WHERE id='dd3f7cfea48304d777433295a671c3db'),notes_acknowledged=1 WHERE id='c26a2026-1125-4e60-95a8-63ce80123b4b' AND status='draft';
UPDATE fin_rapbm_years SET active_version_id='c26a2026-1125-4e60-95a8-63ce80123b4b',publication_revision=1 WHERE year=2026;

INSERT INTO fin_komite_rapbm_versions (version_id,cohort,previous_version_id,activated_by,enabled,prior_unspent,carry_forward,revision_reason)
VALUES ('c26a2026-1125-4e60-95a8-63ce80123b4b',2026,NULL,COALESCE((SELECT id FROM "user" WHERE id='dd3f7cfea48304d777433295a671c3db'),(SELECT id FROM "user" LIMIT 1)),0,0,0,NULL);

INSERT INTO fin_komite_budget_positions (group_id,amount,reason) VALUES
  ('16223cfa-6528-4f61-abd8-c79b1bc08cd4',376320000,NULL),
  ('4ac0788e-186e-4d37-ae48-ca4a5d7b789e',5040000,NULL),
  ('1ae9e23f-7c56-44f3-ad69-c9f29ee7ef4e',101900000,NULL),
  ('e65702e3-adc6-488f-a1bc-3746453f28ed',41040000,NULL),
  ('cb11e58d-c7d9-44d4-adf3-e7b1f9e4f9f2',15480000,NULL),
  ('bf11cc8b-a19d-4a68-a5d6-598d6dbaafd0',325440000,NULL),
  ('1b3866cb-0836-4b13-a36c-121acc06a6b7',53200000,NULL),
  ('cdb12762-b079-48b1-ad41-a6b19279ec42',353000000,NULL),
  ('44bdd699-80b7-4bfd-ae12-995e36c33df3',36000000,NULL),
  ('f091bd60-31bc-4274-a0df-e5dd77a45f70',260000000,NULL),
  ('ac34da0a-b942-4106-a9d8-3189cd893122',0,NULL),
  ('04099f2e-e051-44f4-abe9-a91d01538fa3',262200000,NULL),
  ('de01c3d4-c3ae-4cd9-ac53-5c74107f04ab',10000000,NULL),
  ('00b1e698-bfce-4149-a251-0403b5ef94c3',0,NULL),
  ('6aa3ce33-671c-41ac-a049-f54fddf7aeaf',0,NULL),
  ('69eea465-e3fb-4df0-abb5-4b8b841b93d2',0,NULL),
  ('26ec38e5-156b-4bfb-a724-73dd623253ae',372580000,NULL);

INSERT INTO activity_logs (id,actor_user_id,actor_name,actor_roles,module,action,severity,summary,entity_type,entity_id,entity_label,before_json,after_json,metadata_json)
VALUES (lower(hex(randomblob(16))),(SELECT id FROM "user" WHERE id='dd3f7cfea48304d777433295a671c3db'),'M. Iqbal Abdul Wakil, M.Pd.','["super_admin"]','rapbm','replace_unactivated_version','info','Menimpa RAPBM Angkatan 2026 yang belum aktif dengan dokumen Excel terbaru','rapbm_version','c26a2026-1125-4e60-95a8-63ce80123b4b','RAPBM 2026 Angkatan 2026','{"version_id":"b18f2231-995c-4ea5-b3cc-de9b73076ff7","source_sha256":"f3005a3c814857c2b02c38e4c7551b94a7b1f15fd6a143442e11e321be16293e","income_total":4538936000,"expense_komite":2095500000,"enabled":0,"allocations":0}','{"version_id":"c26a2026-1125-4e60-95a8-63ce80123b4b","source_sha256":"63ce80123b4b2dff0cc8cbc5ca0d0b48f57f2c25f4e7515fcee694cb97eb0505","r2_key":"private/rapbm/2026/c26a2026-1125-4e60-95a8-63ce80123b4b.xlsx","income_total":4666436000,"expense_komite":2212200000,"enabled":0}','{"cohort":2026,"year":2026,"noteCount":5,"notesAcknowledged":true,"reason":"Penggantian dokumen awal RAPBM Angkatan 2026 yang belum diaktifkan atas permintaan pengguna"}');

INSERT INTO fin_komite_transaction_guard SELECT 1, 0 WHERE NOT (
  (SELECT COUNT(*) FROM fin_rapbm_versions WHERE year=2026)=1
  AND EXISTS (SELECT 1 FROM fin_rapbm_versions WHERE id='c26a2026-1125-4e60-95a8-63ce80123b4b' AND status='published' AND komite_cohort=2026)
  AND (SELECT COUNT(*) FROM fin_rapbm_groups WHERE version_id='c26a2026-1125-4e60-95a8-63ce80123b4b')=19
  AND (SELECT COUNT(*) FROM fin_rapbm_items i JOIN fin_rapbm_groups g ON g.id=i.group_id WHERE g.version_id='c26a2026-1125-4e60-95a8-63ce80123b4b')=108
  AND (SELECT SUM(amount) FROM fin_komite_budget_positions p JOIN fin_rapbm_groups g ON g.id=p.group_id WHERE g.version_id='c26a2026-1125-4e60-95a8-63ce80123b4b')=2212200000
);
