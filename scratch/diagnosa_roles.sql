-- Diagnosa: Tampilkan guru yang primary role-nya tidak ada di user_roles
SELECT u.id, u.nama_lengkap, u.role as primary_role,
       GROUP_CONCAT(ur.role) as roles_in_user_roles
FROM user u
LEFT JOIN user_roles ur ON ur.user_id = u.id
GROUP BY u.id
HAVING roles_in_user_roles NOT LIKE '%' || u.role || '%'
   AND u.role NOT IN ('ortu', 'siswa')
LIMIT 30;
