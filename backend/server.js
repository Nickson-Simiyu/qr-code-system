const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
const PORT = 5000;
const SECRET_KEY = "your_secret_key";

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Handle JSON errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }
  next();
});

// MySQL Connection with Auto-Reconnect
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "#Kenya2020",
  database: "attendance_system",
  multipleStatements: true,
});

function handleDisconnect() {
  db.connect((err) => {
    if (err) {
      console.error("Database connection failed: " + err.message);
      setTimeout(handleDisconnect, 2000);
    } else {
      console.log("Connected to MySQL Database");
    }
  });
  db.on("error", (err) => {
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      handleDisconnect();
    } else {
      throw err;
    }
  });
}
handleDisconnect();

// Serve Pages
app.get("/student", (req, res) =>
  res.sendFile(path.join(__dirname, "student.html"))
);
app.get("/teacher", (req, res) =>
  res.sendFile(path.join(__dirname, "teacher.html"))
);

// Register Student
app.post("/register-student", (req, res) => {
  const { student_id, name, email, password } = req.body;
  if (!student_id || !name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.query(
    "INSERT INTO students (student_id, name, email, password) VALUES (?, ?, ?, ?)",
    [student_id, name, email, hashedPassword],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Student registered successfully" });
    }
  );
});

// Register Lecturer with Course Handling
app.post("/register-lecturer", (req, res) => {
  const { lecturer_id, name, email, password, course_id, course_name } =
    req.body;
  if (
    !lecturer_id ||
    !name ||
    !email ||
    !password ||
    !course_id ||
    !course_name
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const hashedPassword = bcrypt.hashSync(password, 10);

  db.query(
    "INSERT IGNORE INTO courses (course_id, course_name) VALUES (?, ?)",
    [course_id, course_name],
    (err) => {
      if (err)
        return res
          .status(500)
          .json({ error: "Error adding course: " + err.message });
      db.query(
        "INSERT INTO lecturers (lecturer_id, name, email, password, course_id) VALUES (?, ?, ?, ?, ?)",
        [lecturer_id, name, email, hashedPassword, course_id],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: "Lecturer registered successfully with course" });
        }
      );
    }
  );
});
// Get Attendance
// Get Attendance with Student & Course Details
app.get("/api/attendance", (req, res) => {
    const sql = `
      SELECT 
        attendance.student_id,
        students.name,
        students.email,
        courses.course_name,
        attendance.scan_datetime
      FROM attendance
      JOIN students ON attendance.student_id = students.student_id
      JOIN courses ON attendance.course_id = courses.course_id
      ORDER BY attendance.scan_datetime DESC
    `;
  
    db.query(sql, (err, results) => {
      if (err) {
        console.error("Database Error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
      }
      res.json(results);
    });
  });
  

app.post("/verify-attendance", (req, res) => {
  const { student_id } = req.body;

  if (!student_id) {
    return res.status(400).json({ message: "Student ID is required" });
  }

  db.query(
    "SELECT course_id FROM enrollments WHERE student_id = ?",
    [student_id],
    (err, results) => {
      if (err)
        return res.status(500).json({ error: "Database error", details: err });
      if (results.length === 0)
        return res
          .status(404)
          .json({ message: "No enrolment found for this student" });

      const course_id = results[0].course_id;

      // ✅ Check if attendance for today already exists
      db.query(
        "SELECT * FROM attendance WHERE student_id = ? AND course_id = ? AND DATE(scan_datetime) = CURDATE()",
        [student_id, course_id],
        (err, existingAttendance) => {
          if (err)
            return res
              .status(500)
              .json({ error: "Database error", details: err });

          if (existingAttendance.length > 0) {
            // ✅ Attendance already marked today, so update timestamp
            db.query(
              "UPDATE attendance SET scan_datetime = NOW() WHERE student_id = ? AND course_id = ? AND DATE(scan_datetime) = CURDATE()",
              [student_id, course_id],
              (err) => {
                if (err)
                  return res
                    .status(500)
                    .json({
                      error: "Failed to update attendance",
                      details: err,
                    });
                res.json({
                  valid: true,
                  message: "Attendance updated successfully",
                });
              }
            );
          } else {
            // ✅ No attendance today, insert a new record
            db.query(
              "INSERT INTO attendance (student_id, course_id, scan_datetime) VALUES (?, ?, NOW())",
              [student_id, course_id],
              (err) => {
                if (err)
                  return res
                    .status(500)
                    .json({ error: "Failed to log attendance", details: err });
                res.json({
                  valid: true,
                  message: "Attendance marked successfully",
                });
              }
            );
          }
        }
      );
    }
  );
});

app.get("/api/courses", (req, res) => {
  db.query("SELECT course_id, course_name FROM courses", (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(results);
  });
});

app.post("/api/enroll", (req, res) => {
  const { student_id, course_id } = req.body;

  if (!student_id || !course_id) {
    return res
      .status(400)
      .json({ message: "Student ID and Course ID are required" });
  }

  db.query(
    "INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)",
    [student_id, course_id],
    (err) => {
      if (err)
        return res.status(500).json({ error: "Failed to enroll student" });
      res.json({ message: "Enrollment successful" });
    }
  );
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required" });

  db.query(
    "SELECT * FROM students WHERE email = ?",
    [email],
    (err, studentResults) => {
      if (err) return res.status(500).json({ error: err.message });
      if (studentResults.length > 0) {
        const student = studentResults[0];
        bcrypt.compare(password, student.password, (err, isMatch) => {
          if (err) return res.status(500).json({ error: "Hashing error" });
          if (!isMatch)
            return res.status(401).json({ message: "Invalid credentials" });
          const token = jwt.sign(
            { id: student.student_id, role: "student" },
            SECRET_KEY,
            { expiresIn: "1h" }
          );
          return res.json({
            token,
            role: "student",
            id: student.student_id,
            redirect: "/student",
          });
        });
      } else {
        db.query(
          "SELECT * FROM lecturers WHERE email = ?",
          [email],
          (err, lecturerResults) => {
            if (err) return res.status(500).json({ error: err.message });
            if (lecturerResults.length === 0)
              return res.status(401).json({ message: "User not found" });
            const lecturer = lecturerResults[0];
            bcrypt.compare(password, lecturer.password, (err, isMatch) => {
              if (err) return res.status(500).json({ error: "Hashing error" });
              if (!isMatch)
                return res.status(401).json({ message: "Invalid credentials" });
              const token = jwt.sign(
                { id: lecturer.lecturer_id, role: "lecturer" },
                SECRET_KEY,
                { expiresIn: "1h" }
              );
              return res.json({
                token,
                role: "lecturer",
                id: lecturer.lecturer_id,
                redirect: "/teacher",
              });
            });
          }
        );
      }
    }
  );
});

// Start Server
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
