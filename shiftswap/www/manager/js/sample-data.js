// =============================================================
// sample-data.js  –  fake data that is a COPY of Sujal's seed.sql
// (same people, same ids, same shifts, same swaps), so the manager
// pages look exactly the same before and after the real API is on.
// Dates are worked out from this week's Monday, like seed.sql does.
// =============================================================

function buildSampleData() {
  const monday = getMonday(new Date());

  // Helper: the date "n" days after this Monday, as 'YYYY-MM-DD'
  function day(n) {
    const d = new Date(monday);
    d.setDate(d.getDate() + n);
    return formatDate(d);
  }

  // Employees from seed.sql (id 1 is Priya, the manager, so she isn't here)
  const staff = [
    { id: 2, name: "Tom Baker", email: "tom@shiftswap.test", hourly_rate: 12.5 },
    { id: 3, name: "Aisha Khan", email: "aisha@shiftswap.test", hourly_rate: 12.5 },
    { id: 4, name: "Leo Martin", email: "leo@shiftswap.test", hourly_rate: 13.0 },
    { id: 5, name: "Sara Novak", email: "sara@shiftswap.test", hourly_rate: 13.0 },
  ];

  // Shifts from seed.sql (same ids 1–10)
  const shifts = [
    { id: 1, shift_date: day(0), start_time: "07:00", end_time: "12:00", position: "Barista", assigned_to: 2, status: "assigned" },
    { id: 2, shift_date: day(0), start_time: "12:00", end_time: "17:00", position: "Till", assigned_to: 3, status: "assigned" },
    { id: 3, shift_date: day(1), start_time: "07:00", end_time: "12:00", position: "Barista", assigned_to: 4, status: "assigned" },
    { id: 4, shift_date: day(1), start_time: "12:00", end_time: "17:00", position: "Till", assigned_to: 5, status: "assigned" },
    { id: 5, shift_date: day(2), start_time: "09:00", end_time: "15:00", position: "Barista", assigned_to: 2, status: "assigned" },
    { id: 6, shift_date: day(3), start_time: "07:00", end_time: "12:00", position: "Till", assigned_to: 3, status: "assigned" },
    { id: 7, shift_date: day(3), start_time: "12:00", end_time: "17:00", position: "Barista", assigned_to: 4, status: "open" },
    { id: 8, shift_date: day(4), start_time: "10:00", end_time: "18:00", position: "Stock", assigned_to: 5, status: "open" },
    { id: 9, shift_date: day(5), start_time: "09:00", end_time: "14:00", position: "Barista", assigned_to: 2, status: "assigned" },
    { id: 10, shift_date: day(5), start_time: "14:00", end_time: "19:00", position: "Till", assigned_to: null, status: "open" },
  ];

  // Swaps from seed.sql. Status "accepted" = a colleague said yes,
  // now it is waiting for the manager. "pending" = nobody has accepted yet.
  //  1: Leo put his Thursday shift up for anyone (employees accept it – Masrur)
  //  2: Sara gave her Friday shift to Aisha, who accepted (manager approves – Lajja)
  const swaps = [
    { id: 1, shift_id: 7, from_user_id: 4, to_user_id: null, status: "pending", created_at: day(0) + " 09:00:00" },
    { id: 2, shift_id: 8, from_user_id: 5, to_user_id: 3, status: "accepted", created_at: day(0) + " 10:00:00" },
  ];

  return { staff: staff, shifts: shifts, swaps: swaps, nextShiftId: 11 };
}
