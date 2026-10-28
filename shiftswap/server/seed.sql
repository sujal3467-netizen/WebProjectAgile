-- =============================================================
-- ShiftSwap test data (Week 1, Tuesday) – owner: Sujal
-- Jira: SS-6
--
-- Every test user's password is:  password123
-- The password_hash values were made with PBKDF2-SHA256
-- (format: pbkdf2$iterations$salt$hash). In Week 2 the login
-- route will check passwords using exactly the same method.
-- =============================================================

-- ---------- 1 manager + 4 employees ----------
INSERT INTO users (name, email, password_hash, role, hourly_rate) VALUES
('Priya Shah',  'priya@shiftswap.test', 'pbkdf2$100000$d8e0eedf9732ef449d3952fc00ab05a9$73c7e876c48ff53ba475d68e9d8066c709b11bfd812086ec93815418a090dc91', 'manager',  16.00),
('Tom Baker',   'tom@shiftswap.test',   'pbkdf2$100000$d12a1efb35db358a0312b6b468688f34$9772df65f8e02e64f4a472fb497776ce3f1db7cffe89061bfba00080eae4a5b1', 'employee', 12.50),
('Aisha Khan',  'aisha@shiftswap.test', 'pbkdf2$100000$edfede42b453dd2f03a50bc3bf427681$fa7dde2cd25df6bbccc64b7f50a648b44badf27dc50965c282b76fcf667049c4', 'employee', 12.50),
('Leo Martin',  'leo@shiftswap.test',   'pbkdf2$100000$3f126d6c1517823c70770ae96c25d56c$f0c3179c01f12c770b5f36677748c8cf9d70713bff80248732ab4d0d2506a751', 'employee', 13.00),
('Sara Novak',  'sara@shiftswap.test',  'pbkdf2$100000$57701301d348cb08a6f17688c12635f2$703720cab19d6f3a55f4c1d0585faee429c3082715bc6dc84031356297e8e732', 'employee', 13.00);
-- ids: 1 = Priya (manager), 2 = Tom, 3 = Aisha, 4 = Leo, 5 = Sara

-- ---------- Shifts for THIS week ----------
-- date('now', '-6 days', 'weekday 1') = the Monday of the current week.
-- Using it instead of fixed dates means the test data always shows
-- shifts "this week", even when we demo it in Week 5.
--   '+1 day' = Tuesday, '+2 days' = Wednesday, and so on.
INSERT INTO shifts (shift_date, start_time, end_time, position, assigned_to, status) VALUES
(date('now', '-6 days', 'weekday 1'),            '07:00', '12:00', 'Barista', 2, 'assigned'),  -- 1 Mon Tom
(date('now', '-6 days', 'weekday 1'),            '12:00', '17:00', 'Till',    3, 'assigned'),  -- 2 Mon Aisha
(date('now', '-6 days', 'weekday 1', '+1 day'),  '07:00', '12:00', 'Barista', 4, 'assigned'),  -- 3 Tue Leo
(date('now', '-6 days', 'weekday 1', '+1 day'),  '12:00', '17:00', 'Till',    5, 'assigned'),  -- 4 Tue Sara
(date('now', '-6 days', 'weekday 1', '+2 days'), '09:00', '15:00', 'Barista', 2, 'assigned'),  -- 5 Wed Tom
(date('now', '-6 days', 'weekday 1', '+3 days'), '07:00', '12:00', 'Till',    3, 'assigned'),  -- 6 Thu Aisha
(date('now', '-6 days', 'weekday 1', '+3 days'), '12:00', '17:00', 'Barista', 4, 'open'),      -- 7 Thu Leo (being swapped)
(date('now', '-6 days', 'weekday 1', '+4 days'), '10:00', '18:00', 'Stock',   5, 'assigned'),  -- 8 Fri Sara
(date('now', '-6 days', 'weekday 1', '+5 days'), '09:00', '14:00', 'Barista', 2, 'assigned'),  -- 9 Sat Tom
(date('now', '-6 days', 'weekday 1', '+5 days'), '14:00', '19:00', 'Till',    NULL, 'open');   -- 10 Sat nobody yet

-- ---------- One swap request waiting, so the pages have something to show ----------
-- Leo (4) has put his Thursday shift (7) up for anyone to take.
INSERT INTO swap_requests (shift_id, from_user_id, to_user_id, status) VALUES
(7, 4, NULL, 'pending');

-- ---------- A couple of notifications for Bikram to test the bell page ----------
INSERT INTO notifications (user_id, message, link, is_read) VALUES
(1, 'Leo Martin posted a shift for swap (Thursday 12:00–17:00).', '/manager/swaps.html', 0),
(2, 'A Thursday Barista shift is open – want it?',              '/employee/open-shifts.html', 0);
