process.env['NODE_ENV'] ??= 'test';
process.env['PORT'] ??= '3001';
process.env['DATABASE_URL'] ??=
  'postgresql://postgres:password@localhost:5432/tennis_club';
process.env['FRONTEND_ORIGIN'] ??= 'http://localhost:3000';
process.env['ADMIN_EMAIL'] ??= 'admin@example.com';
process.env['ADMIN_PASSWORD'] ??= 'changeme-admin';
process.env['ADMIN_NAME'] ??= 'Admin';
process.env['CLUB_NAME'] ??= 'Tennis Club';
process.env['CLUB_TIMEZONE'] ??= 'America/New_York';
process.env['CLUB_WEEK_START'] ??= '1';
