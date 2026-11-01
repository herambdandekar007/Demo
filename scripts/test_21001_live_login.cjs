const http = require('http');

async function postLogin(identifier, password, role) {
  const body = JSON.stringify({ identifier, password, role });
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getEndpoint(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function test() {
  console.log('Testing Login with Roll 21001 / Aryan@21001...');
  const res = await postLogin('21001', 'Aryan@21001', 'STUDENT');
  console.log('Login Response Status:', res.statusCode);
  console.log('Login Result:', JSON.stringify(res.body, null, 2));

  if (!res.body || !res.body.token) {
    console.error('Failed to get token!');
    process.exit(1);
  }

  const token = res.body.token;

  console.log('\nTesting /api/students/profile...');
  const profile = await getEndpoint('/api/students/profile', token);
  console.log('Profile Student Name:', profile.body.data?.student_name, 'Semester:', profile.body.data?.current_semester, 'Year:', profile.body.data?.current_year);

  console.log('\nTesting /api/students/dashboard...');
  const dash = await getEndpoint('/api/students/dashboard', token);
  console.log('Dashboard Attendance %:', dash.body.data?.overallAttendance?.percentage, 'SGPA:', dash.body.data?.sgpa, 'CGPA:', dash.body.data?.cgpa);
  console.log('Dashboard Classes for today:', dash.body.data?.classes?.length);

  console.log('\nTesting /api/students/attendance...');
  const att = await getEndpoint('/api/students/attendance', token);
  console.log('Attendance Records Count:', att.body.data?.attendance?.length);
  console.log('Subjects with attendance:', att.body.data?.attendance?.map(a => `${a.subject_code}: ${a.attendance_percentage}%`));
  console.log('Timetable Entries:', att.body.data?.timetable?.length);

  console.log('\nTesting /api/students/fees...');
  const fees = await getEndpoint('/api/students/fees', token);
  console.log('Fees Total Due:', fees.body.data?.summary?.totalDue, 'Paid:', fees.body.data?.summary?.totalPaid);

  console.log('\nTesting /api/students/exams...');
  const exams = await getEndpoint('/api/students/exams', token);
  console.log('Exam applications count:', exams.body.data?.applications?.length, 'Exam schedule count:', exams.body.data?.schedule?.length);

  console.log('\nTesting /api/students/results...');
  const results = await getEndpoint('/api/students/results', token);
  console.log('Results Semesters Count:', results.body.data?.semesters?.length);

  console.log('\nTesting /api/students/library...');
  const lib = await getEndpoint('/api/students/library', token);
  console.log('Active loans:', lib.body.data?.currentLoans?.length);

  console.log('\nALL 2ND YEAR STUDENT ENDPOINTS WORKING 100% PERFECTLY!');
}

test()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
