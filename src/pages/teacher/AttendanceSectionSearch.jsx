/**
 * AttendanceForm component that allows a teacher to record attendance for students in a section.
 * @returns JSX element containing the attendance form UI.
 */
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";

export default function AttendanceForm() {
  const { currentUser } = useAuth();
  const [section, setSection] = useState("");
  const [students, setStudents] = useState([]);
  const [date, setDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [course, setCourse] = useState("");
  
  // Set default date on component mount
  useEffect(() => {
    // Set default date to today
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    setDate(formattedDate);
  }, []);
  
  // Fetch students when a section is entered
  useEffect(() => {
    async function fetchStudents() {
      if (!section) return;
      
      try {
        setIsLoading(true);
        // Assuming we're storing students in a collection by section
        // You might need to adjust this query based on your Firestore structure
        const studentsSnapshot = await getDocs(collection(db, "sections", section, "students"));
        
        const studentsData = studentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          isPresent: true, // Default to present
          comment: ""
        }));
        
        setStudents(studentsData);
        
        // Extract course info from the section data if available
        if (studentsData.length > 0 && studentsData[0].course) {
          setCourse(studentsData[0].course);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching students:", error);
        setIsLoading(false);
      }
    }
    
    if (section) {
      fetchStudents();
    }
  }, [section]);
  
  const handleStatusChange = (studentId, status) => {
    setStudents(students.map(student => 
      student.id === studentId ? { ...student, isPresent: status } : student
    ));
  };
  
  const handleCommentChange = (studentId, comment) => {
    setStudents(students.map(student => 
      student.id === studentId ? { ...student, comment } : student
    ));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!section || !date) {
      setStatus({ type: "error", message: "Please enter a section and date" });
      return;
    }
    
    try {
      setIsLoading(true);
      setStatus({ type: "loading", message: "Submitting attendance..." });
      
      // Create attendance record
      const attendanceRecord = {
        section: section,
        course: course,
        date: date,
        teacherId: currentUser.uid,
        timestamp: serverTimestamp(),
        students: students.map(student => ({
          studentId: student.id,
          name: student.name,
          studentIdNumber: student.studentId || "",
          email: student.email || "",
          section: section,
          course: course,
          isPresent: student.isPresent,
          comment: student.comment
        }))
      };
      
      await addDoc(collection(db, "attendance"), attendanceRecord);
      
      setStatus({ type: "success", message: "Attendance submitted successfully!" });
      setIsLoading(false);
    } catch (error) {
      console.error("Error submitting attendance:", error);
      setStatus({ type: "error", message: "Failed to submit attendance" });
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Record Attendance</h1>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="section" className="block text-sm font-medium text-gray-700 mb-1">
              Section
            </label>
            <input
              type="text"
              id="section"
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="LFAU333A004"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              required
            />
          </div>
          
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              id="date"
              className="w-full p-2 border border-gray-300 rounded-md"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>
        
        {isLoading && !students.length ? (
          <div className="text-center py-12">Loading students...</div>
        ) : !section ? (
          <div className="text-center py-12 text-gray-500">Please enter a section to view students</div>
        ) : students.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No students found in this section</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-3 px-4 text-left">Name</th>
                  <th className="py-3 px-4 text-left">Student ID</th>
                  <th className="py-3 px-4 text-left">Email</th>
                  <th className="py-3 px-4 text-left">Section</th>
                  <th className="py-3 px-4 text-left">Course</th>
                  <th className="py-3 px-4 text-left">Status</th>
                  <th className="py-3 px-4 text-left">Comment</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student => (
                  <tr key={student.id} className="border-t">
                    <td className="py-3 px-4">{student.name}</td>
                    <td className="py-3 px-4">{student.studentId || "-"}</td>
                    <td className="py-3 px-4">{student.email || "-"}</td>
                    <td className="py-3 px-4">{section}</td>
                    <td className="py-3 px-4">{course}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-4">
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            className="form-radio text-blue-600"
                            name={`status-${student.id}`}
                            checked={student.isPresent}
                            onChange={() => handleStatusChange(student.id, true)}
                          />
                          <span className="ml-2">Present</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            className="form-radio text-red-600"
                            name={`status-${student.id}`}
                            checked={!student.isPresent}
                            onChange={() => handleStatusChange(student.id, false)}
                          />
                          <span className="ml-2">Absent</span>
                        </label>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        className="w-full p-1 border border-gray-300 rounded"
                        placeholder="Add comment (optional)"
                        value={student.comment}
                        onChange={(e) => handleCommentChange(student.id, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {section && students.length > 0 && (
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-md font-medium"
              disabled={isLoading}
            >
              {isLoading ? "Submitting..." : "Submit Attendance"}
            </button>
          </div>
        )}
        
        {status && (
          <div className={`mt-4 p-3 rounded ${
            status.type === "success" ? "bg-green-100 text-green-700" : 
            status.type === "error" ? "bg-red-100 text-red-700" : 
            "bg-blue-100 text-blue-700"
          }`}>
            {status.message}
          </div>
        )}
      </form>
    </div>
  );
}