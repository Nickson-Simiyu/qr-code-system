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
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: "Invalid JSON payload" });
    }
    next();
});

// MySQL Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "#Kenya2020",
    database: "attendance_system"
});

db.connect(err => {
    if (err) {
        console.error("Database connection failed: " + err.message);
    } else {
        console.log("Connected to MySQL Database");
    }
});

// Serve student.html and teacher.html
app.get("/student", (req, res) => {
    res.sendFile(path.join(__dirname, "student.html"));
});


app.get("/teacher", (req, res) => {
    res.sendFile(path.join(__dirname, "teacher.html"));
});

// Register Student
app.post("/register-student", (req, res) => {
    const { student_id, name, email, password } = req.body;
    
    if (!student_id || !name || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    const sql = "INSERT INTO students (student_id, name, email, password) VALUES (?, ?, ?, ?)";
    
    db.query(sql, [student_id, name, email, hashedPassword], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Student registered successfully" });
    });
});


// Register Lecturer
app.post("/register-lecturer", (req, res) => {
    const { lecturer_id, name, email, password, course_id, course_name } = req.body;
    
    if (!lecturer_id || !name || !email || !password || !course_id || !course_name) {
        return res.status(400).json({ message: "All fields are required" });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    // Step 1: Check if course exists
    db.query("SELECT * FROM courses WHERE course_id = ?", [course_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length === 0) {
            // Step 2: Insert course if not found
            db.query("INSERT INTO courses (course_id, course_name) VALUES (?, ?)", [course_id, course_name], (err) => {
                if (err) return res.status(500).json({ error: "Error adding course: " + err.message });

                console.log("✅ Course added:", course_id);
            });
        }

        // Step 3: Insert Lecturer
        const sql = "INSERT INTO lecturers (lecturer_id, name, email, password, course_id) VALUES (?, ?, ?, ?, ?)";
        db.query(sql, [lecturer_id, name, email, hashedPassword, course_id], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json({ message: "Lecturer registered successfully with course" });
        });
    });
});



app.get("/api/attendance", (req, res) => {
    const student_id = req.query.student_id;

    if (!student_id) {
        return res.status(400).json({ error: "Student ID is required" });
    }

    db.query(
        "SELECT scan_datetime, course_id FROM attendance WHERE student_id = ?",
        [student_id],
        (err, results) => {
            if (err) {
                console.error("❌ Database Error:", err);
                return res.status(500).json({ error: err.message });
            }
            if (results.length === 0) {
                return res.status(404).json({ error: "No attendance records found" });
            }
            res.json(results);
        }
    );
});


app.post("/verify-attendance", (req, res) => {
    const { student_id } = req.body;  // ✅ Expect student_id instead of email

    if (!student_id) {
        return res.status(400).json({ message: "Student ID is required" });
    }

    db.query("SELECT * FROM students WHERE student_id = ?", [student_id], (err, results) => {
        if (err) {
            console.error("❌ Database Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }

        if (results.length > 0) {
            const student = results[0];

            // ✅ Log attendance in `attendance` table
            db.query(
                "INSERT INTO attendance (student_id, name, email, date) VALUES (?, ?, ?, NOW())",
                [student.student_id, student.name, student.email],
                (err) => {
                    if (err) {
                        console.error("❌ Error inserting attendance:", err);
                        return res.status(500).json({ error: "Failed to log attendance" });
                    }

                    res.json({ valid: true, message: `Attendance marked for ${student.name}` });
                }
            );
        } else {
            res.status(404).json({ valid: false, message: "Student not found" });
        }
    });
});



// Login with Email
app.post("/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    // 🔹 Check students table first
    db.query("SELECT * FROM students WHERE email = ?", [email], (err, studentResults) => {
        if (err) return res.status(500).json({ error: err.message });

        if (studentResults.length > 0) {
            const student = studentResults[0];
            bcrypt.compare(password, student.password, (err, isMatch) => {
                if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

                console.log("🔍 Sending Student ID:", student.student_id);  // ✅ Debugging
                const token = jwt.sign({ id: student.student_id, role: "student" }, SECRET_KEY, { expiresIn: "1h" });

                return res.json({ token, role: "student", id: student.student_id, redirect: "/student" });
            });
        } else {
            // 🔹 If not found in students, check lecturers table
            db.query("SELECT * FROM lecturers WHERE email = ?", [email], (err, lecturerResults) => {
                if (err) return res.status(500).json({ error: err.message });

                if (lecturerResults.length > 0) {
                    const lecturer = lecturerResults[0];
                    bcrypt.compare(password, lecturer.password, (err, isMatch) => {
                        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

                        console.log("🔍 Sending Lecturer ID:", lecturer.lecturer_id);  // ✅ Debugging
                        const token = jwt.sign({ id: lecturer.lecturer_id, role: "lecturer" }, SECRET_KEY, { expiresIn: "1h" });

                        return res.json({ token, role: "lecturer", id: lecturer.lecturer_id, redirect: "/teacher" });
                    });
                } else {
                    return res.status(401).json({ message: "User not found" });
                }
            });
        }
    });
});



// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
