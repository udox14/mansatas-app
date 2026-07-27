export type DefaultTeacherCode = {
  code: string
  name: string
}

const REFERENCE_TEACHER_CODES: Array<[string | null, string]> = [
  ['1', 'Drs. H. Rudi Hariyono'],
  ['2', 'H. Undang Kurniawan, M.Pd.'],
  ['3', 'Dra. Euis'],
  ['4', 'Dra. Hj. Noneng Haryati, M.PMat.'],
  ['5', 'Neneng Lilies Yulisfianti, S.Pd.'],
  ['6', 'Drs. Ayep Tedi Suwandi'],
  ['7', 'Dra. Lina Marlina'],
  ['8', 'N. Susilawati, S.Pd.'],
  ['9', 'Eneng Sri Supriatin, M.Pd.'],
  ['10', 'Zainal Mutaqin, S.Pd.'],
  ['11', 'Hentarmah, S.Pd.'],
  ['12', 'H. Juheli, S.Pd.'],
  ['13', 'Dude Palhan, S.Pd.'],
  ['14', 'Neni Nuraeni, S.Ag.'],
  ['15', 'Hj. Heni Nurpuadah, S.Ag.'],
  ['16', 'H. Dindin Solahudin, M.Pd.'],
  ['17', 'Nunu Hasanudin, S.Pd.'],
  ['18', 'Jajang Agus, S.Pd.'],
  ['19', 'Ela Nurlaela Sari, S.Pd., M.Si.'],
  ['20', 'H. Asep Mulyana, S.Ag.'],
  ['21', 'Adi Majdi Syam, S.Ag.'],
  ['22', 'Ii Hidayati, S.Pd.'],
  ['23', 'Dede Fathul Umam, S.Pd.I.'],
  ['24', 'Adiyoso Nuha, M.Pd.I.'],
  ['25', 'Wawan Purwanda, S.Pd.'],
  ['26', 'Henhen Hanifah, S.Pd.'],
  ['27', 'Muhammad Ropik Nazib, M.Ag.'],
  ['28', 'Ayi Nurhasanah, S.Pd.'],
  ['29', 'Indra Kurniawan, S.Pd.'],
  ['30', 'Rachmayadi, S.Pd.'],
  ['31', 'Rika Mulyani, S.Pd.'],
  ['32', 'Asep Abdul Aziz M., S.Pd.'],
  ['33', 'Melasari, S.Pd.'],
  ['34', 'Neng Irma Kurniawati, S.Pd.'],
  ['35', 'Aji Abdul Aziz, S.Pd.'],
  ['36', 'Robi Nurtsani, S.Pd.I.'],
  ['37', 'Isna Siti Sofiani, S.Pd.'],
  ['38', 'Euis Heni Susilawati, S.Pd.I.'],
  ['39', 'Multi Agustina, S.Pd.'],
  ['40', 'Nida Ariani, S.Kom.'],
  ['41', 'Eva Nurlatipah, S.Ag.'],
  ['42', 'Elis Nurhasanah, S.Ag.'],
  ['43', 'Deden Nurul Yaqin Syahidin, S.E.'],
  ['44', 'Aten Zaenal Mustafa, S.Pd.I.'],
  ['43', 'Sahrullah Nazem, M.Pd.I.'],
  ['46', 'Ahmad Alfaruq, S.Pd.'],
  ['47', 'Hanatul Fadilah, S.Sos.'],
  ['48', 'Ratnadila Khaerunnisa, S.Pd.'],
  ['49', 'Ai Nurhasanah, S.Pd.'],
  ['50', 'Nia Nursalis, S.Pd.'],
  ['51', 'Selmy Niatama Iskandar, S.Pd.'],
  ['52', 'Rahmayati, S.Psi.'],
  ['53', 'Emuh Muhaemin, S.Ag.'],
  ['54', 'H. Iqbal Riyanto, S.Pd.I.'],
  ['55', 'Refki Julian, S.Pd.'],
  ['56', "Imam Safe'i, M.Pd.I."],
  ['57', 'Ona Suryana, S.Pd.I.'],
  ['58', 'M. Iqbal Abdul Wakil, M.Pd.'],
  ['59', 'Rifa Hazim Rustam Fuady, M.Pd.'],
  ['60', 'Najib Munawar, M.Pd.'],
  ['61', 'Syfa Mauldi Dakhlan, S.Pd.'],
  ['62', 'Deni Herdiana, S.Pd.'],
  ['63', 'Ai Dini Romdiani, S.Pd.'],
  ['64', 'Panji Gurmilang, S.Pd.'],
  ['65', 'Fera Afrilia, S.Pd.'],
  ['66', 'U. Anwar Hidayat, M.M.Pd.'],
  ['67', 'Hj. Siska Nurawalianti, S.Pd.'],
  ['68', 'Agus Mustopa Kamal, S.Ag.'],
  ['69', 'Muhamad Yusup, S.Pd.I.'],
  ['70', 'Tiar Abdul Bar Hazim, S.Pd.'],
  ['71', 'Iqbal Taupik Herdiana, S.Pd.'],
  ['72', 'Ali Nurdin, S.Pd.'],
  ['73', 'Aji Rahmat Fuadi, S.Pd.'],
  ['74', 'Eli Hadli, M.Pd.I.'],
  ['75', 'Mohamad Indra Hendriana, S.Pd.'],
  ['76', 'M. Syukron Ramdani, S.Pd.'],
  ['77', 'Azy Hazim Tohir Fuady, M.Pd.I.'],
  ['78', 'Ilham Darussalam, S.Pd.'],
  ['79', 'Encep Ridha MP., M.Pd.'],
  ['80', 'Elis Liskania Arfiani, S.Pd.'],
  ['81', 'H. Ayi Hasan Mustopa, S.Ag.'],
  ['82', 'Nunung Restari, S.Pd.'],
  ['83', 'Ai Rina, S.Pd.'],
  [null, 'Mirawati, S.Pd.'],
  ['84', 'H. Endang Ishak, S.Ag.'],
  ['85', 'Ali Abd. Kholik, M.Pd.I.'],
  ['86', 'Elsa Hoerunnisa, S.Pd.'],
  ['87', 'Sri Utari Alifia Numberi, S.Pd.'],
  ['88', 'Rahmi Dwi Ramdiani, S.Pd.'],
  ['89', 'M. Ghofirly, S.Pd.'],
  ['90', 'Nabiel Azhari Husaeni, S.Pd.'],
  ['91', 'Dede Imam Muharrom, S.Pd.'],
]

function normalizeTeacherName(value: string) {
  const withoutDegrees = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(drs|dra|dr|hj|h)\b\.?/g, ' ')
    .replace(/\b(s|m)\s*\.?\s*(pd|ag|psi|kom|si|sos|e|mat|pdmat)\s*\.?\s*(i|si)?\.?/g, ' ')
    .replace(/\bmp\b\.?/g, ' ')
    .replace(/\b(muhamad|mohamad|muhammad)\b/g, 'muhammad')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return withoutDegrees
}

function levenshtein(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i++) {
    let diagonal = previous[0]
    previous[0] = i
    for (let j = 1; j <= right.length; j++) {
      const above = previous[j]
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      )
      diagonal = above
    }
  }
  return previous[right.length]
}

function similarity(left: string, right: string) {
  if (left === right) return 1
  const maxLength = Math.max(left.length, right.length)
  return maxLength === 0 ? 1 : 1 - levenshtein(left, right) / maxLength
}

export function findDefaultTeacherCode(name: string): DefaultTeacherCode | null {
  const normalized = normalizeTeacherName(name)
  if (!normalized) return null

  let best: { score: number; code: string | null; name: string } | null = null
  for (const [code, referenceName] of REFERENCE_TEACHER_CODES) {
    const referenceNormalized = normalizeTeacherName(referenceName)
    const score = similarity(normalized, referenceNormalized)
    if (!best || score > best.score) best = { score, code, name: referenceName }
  }

  if (!best || best.score < 0.82 || best.code === null) return null
  return { code: best.code, name: best.name }
}
