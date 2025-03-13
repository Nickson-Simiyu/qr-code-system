async function registerStudent() {
    let student_id = document.getElementById("student_id").value;
    let name = document.getElementById("student_name").value;
    let email = document.getElementById("student_email").value;
    let password = document.getElementById("student_password").value;
    
    const response = await fetch("http://localhost:5000/register-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id, name, email, password })
    });
    
    const data = await response.json();
    alert(data.message);
}

async function registerLecturer() {
    let lecturer_id = document.getElementById("lecturer_id").value;
    let name = document.getElementById("lecturer_name").value;
    let email = document.getElementById("lecturer_email").value;
    let password = document.getElementById("lecturer_password").value;
    let course_id = document.getElementById("lecturer_course").value;
    
    const response = await fetch("http://localhost:5000/register-lecturer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lecturer_id, name, email, password, course_id })
    });
    
    const data = await response.json();
    alert(data.message);
}

function generateQRCode() {
    let studentID = localStorage.getItem("student_id");

    console.log("🔍 Debug: Retrieved student ID:", studentID); // Debugging

    if (!studentID) {
        alert("Student ID not found. Please log in again.");
        return;
    }

    document.getElementById("qrcode").innerHTML = "";
    new QRCode(document.getElementById("qrcode"), {
        text: studentID,
        width: 128,
        height: 128
    });
}

async function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const response = await fetch("http://localhost:5000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        console.log("🔹 Received from Backend:", data); // ✅ Debugging line

        if (data.token) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("role", data.role);
            localStorage.setItem("student_id", data.id); // ✅ Fix here!
            console.log("✅ Stored student_id:", data.id); // ✅ Debugging log

            if (data.role === "lecturer") {
                window.location.href = "teacher.html";
            } else if (data.role === "student") {
                window.location.href = "student.html";
            }
        } else {
            alert(data.message || "Invalid login credentials");
        }
    } catch (error) {
        console.error("Login error:", error);
        alert("An error occurred during login. Please try again.");
    }
}

function verifyStudentAttendance(studentId, studentName) {
    fetch("http://localhost:5000/verify-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, studentName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.valid) {
            alert(`Attendance marked for ${studentName}`);
        } else {
            alert("Student not found!");
        }
    })
    .catch(error => console.error("Verification error:", error));
}
