
const API_URL = "https://ecr-api-connection-database.netlify.app/.netlify/functions/service-database"

export const EmailTemplates = {
  GRADE_NOTIFICATION: "grade-notification",
  WELCOME_EMAIL: "welcome-email",
  TEACHER_REGISTRATION: "teacher-registration",
  TEACHER_WELCOME: "teacher-welcome",
  STUDENT_UPDATE: "student-update",
  TEACHER_UPDATE: "teacher-update",
  REGISTRAR_WELCOME: "registrar-welcome",
  ADMIN_WELCOME: "admin-welcome",
  EVENT_INVITATION: "event-invitation",
  EVENT_REMINDER: "event-reminder",
  EVENT_CANCELLATION: "event-cancellation",
  NEW_ATTENDANCE: "new-attendance",
  CERTIFICATE_EMAIL: "certificate-email",
  EVENT_REGISTRATION: "event-registration"
}

export const sendEmail = async ({ template, data, onProgress, onError }) => {
  try {
    let emailContent
    let subject

    switch (template) {
      case EmailTemplates.GRADE_NOTIFICATION:
        ;({ content: emailContent, subject } = createGradeNotificationEmail(data))
        break
      case EmailTemplates.WELCOME_EMAIL:
        // Choose the appropriate welcome email template based on user role
        if (data.role === "student") {
          ;({ content: emailContent, subject } = createStudentWelcomeEmail(data))
        } else if (data.role === "teacher") {
          ;({ content: emailContent, subject } = createTeacherWelcomeEmail(data))
        } else if (data.role === "registrar") {
          ;({ content: emailContent, subject } = createRegistrarWelcomeEmail(data))
        } else if (data.role === "admin") {
          ;({ content: emailContent, subject } = createAdminWelcomeEmail(data))
        } else {
          ;({ content: emailContent, subject } = createGenericWelcomeEmail(data))
        }
        break
      case EmailTemplates.TEACHER_WELCOME:
        ;({ content: emailContent, subject } = createTeacherWelcomeEmail(data))
        break
      case EmailTemplates.TEACHER_REGISTRATION:
        ;({ content: emailContent, subject } = createTeacherRegistrationEmail(data))
        break
      case EmailTemplates.STUDENT_UPDATE:
        ;({ content: emailContent, subject } = createStudentUpdateEmail(data))
        break
      case EmailTemplates.TEACHER_UPDATE:
        ;({ content: emailContent, subject } = createTeacherUpdateEmail(data))
        break
      case EmailTemplates.REGISTRAR_WELCOME:
        ;({ content: emailContent, subject } = createRegistrarWelcomeEmail(data))
        break
      case EmailTemplates.ADMIN_WELCOME:
        ;({ content: emailContent, subject } = createAdminWelcomeEmail(data))
        break
      case EmailTemplates.EVENT_INVITATION:
        ;({ content: emailContent, subject } = createEventInvitationEmail(data))
        break
      case EmailTemplates.EVENT_REMINDER:
        ;({ content: emailContent, subject } = createEventReminderEmail(data))
        break
      case EmailTemplates.EVENT_CANCELLATION:
        ;({ content: emailContent, subject } = createEventCancellationEmail(data))
        break
      case EmailTemplates.NEW_ATTENDANCE:
        ;({ content: emailContent, subject } = createAttendanceNotificationEmail(data))
        break
      case EmailTemplates.CERTIFICATE_EMAIL:
        ;({ content: emailContent, subject } = createCertificateEmail(data))
        break
        case EmailTemplates.EVENT_REGISTRATION:
        ;({ content: emailContent, subject } = createEventRegistrationEmail(data))
        break
      default:
        throw new Error("Invalid email template")
    }

    if (onProgress) {
      onProgress({
        status: "sending",
        ...(data.role && { role: data.role }),
        ...(data.name && { name: data.name }),
      })
    }

    // Prepare the request body
    const requestBody = {
      type: "email",
      data: {
        to: data.email || data.personalEmail,
        subject,
        content: emailContent,
      },
    }

    // Add attachment if certificate image is provided
    if (data.certificateImage) {
      requestBody.data.attachments = [
        {
          filename: data.certificateName || "certificate.png",
          content: data.certificateImage.split("base64,")[1], // Remove the data URL prefix
          encoding: "base64",
          contentType: "image/png",
        },
      ]
    }

    const response = await fetch(`${API_URL}/nfccommunication`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || response.statusText)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error("Email sending failed")
    }

    if (onProgress) {
      onProgress({
        status: "sent",
        ...(data.role && { role: data.role }),
        ...(data.name && { name: data.name }),
      })
    }

    return result
  } catch (error) {
    if (onError) {
      onError({
        error: error.message,
        ...(data.role && { role: data.role }),
        ...(data.name && { name: data.name }),
      })
    }
    throw error
  }
}

// Create Certificate Email Template
const createCertificateEmail = (data) => {
  const styles = getCommonStyles()
  const schoolLogo = "https://imgur.com/QDQZ0IX.png"

  const content = `
    <div style="${styles.container}">
      <!-- Header -->
      <div style="${styles.header}">
        <img src="${schoolLogo}" alt="School Logo" style="width: 80px; height: auto; margin-bottom: 16px;">
        <h1 style="${styles.headerTitle}">Certificate of Participation</h1>
        <p style="${styles.headerSubtitle}">${data.eventDetails?.title || "Event Certificate"}</p>
      </div>
  
      <!-- Main Content -->
      <div style="${styles.body}">
        <!-- Greeting -->
        <p style="${styles.greeting}">
          Hello${data.attendeeName ? ` ${data.attendeeName}` : ""}!
        </p>
        
        <p style="${styles.paragraph}">
          ${data.message || `Congratulations on your participation in ${data.eventDetails?.title || "our event"}!`}
        </p>
        
        <p style="${styles.paragraph}">
          Your certificate is ready! You can view and download it using the link below.
        </p>
        
        <!-- Certificate Link Button -->
        <div style="${styles.buttonContainer}">
          <a href="${data.certificateUrl}" target="_blank" style="${styles.button}">
            View Your Certificate
          </a>
        </div>
        
        ${
          data.eventDetails
            ? `
        <!-- Event Details -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Event Information</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Event:</span>
              <span style="${styles.infoValue}">${data.eventDetails.title}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Date:</span>
              <span style="${styles.infoValue}">${data.eventDetails.date}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Location:</span>
              <span style="${styles.infoValue}">${data.eventDetails.location || "Not specified"}</span>
            </div>
          </div>
        </div>
        `
            : ""
        }
        
        <!-- Signature -->
        <div style="${styles.signature}">
          <p style="${styles.signatureText}">Thank you for your participation!</p>
          <p style="${styles.signatureText}">Best regards,</p>
          <p style="${styles.signatureName}">NextGen-Pemss Team</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        <p style="${styles.footerText}">© ${new Date().getFullYear()} NextGen-Pemss. All rights reserved.</p>
        <p style="${styles.footerText}">This email was sent to ${data.email}</p>
      </div>
    </div>
  `

  return {
    content,
    subject: data.subject || `Your Certificate for ${data.eventDetails?.title || "Event Participation"}`,
  }
}


// Common styles for all email templates
const getCommonStyles = () => {
  return {
    container: `font-family:  Helvetica, Arial, Courier, sans-serif; max-width: 600px; margin: 0 auto; color: #172b4d; line-height: 1.6; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);`,
    header: `background: linear-gradient(135deg, #005acd, #0093cb); padding: 32px 24px; text-align: center;`,
    headerTitle: `font-family: 'Rowdies', sans-serif; color: #ffffff; font-size: 24px; font-weight: 600; margin: 0; letter-spacing: -0.5px;`,
    headerSubtitle: `font-family: 'Open Sans', sans-serif; color: rgba(255, 255, 255, 0.9); font-size: 16px; margin: 8px 0 0 0; font-weight: 400;`,
    body: `padding: 32px 24px; background-color: #ffffff;`,
    greeting: `font-size: 18px; margin: 0 0 24px 0; color: #202124; font-weight: 500;`,
    paragraph: `font-size: 16px; margin: 0 0 24px 0; color: #5f6368;`,
    sectionTitle: `font-size: 20px; font-weight: 600; margin: 0 0 16px 0; color: #202124;`,
    infoCard: `background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #4285F4;`,
    warningCard: `background-color: #fef7e0; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #fbbc04;`,
    warningText: `margin: 0; color: #b06000; font-size: 14px; font-weight: 500;`,
    infoGrid: `display: grid; grid-gap: 16px;`,
    infoRow: `display: flex; justify-content: space-between; border-bottom: 1px solid #e8eaed; padding-bottom: 12px;`,
    infoLabel: `color: #5f6368; font-weight: 500;`,
    infoValue: `font-weight: 600; color: #202124; text-align: right;`,
    button: `display: inline-block; background: linear-gradient(135deg, #005acd, #0093cb); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600; text-align: center; margin: 8px 0; transition: all 0.3s ease;`,
    buttonContainer: `text-align: center; margin: 24px 0;`,
    footer: `text-align: center; padding: 24px; background-color: #f8f9fa; border-top: 1px solid #e8eaed;`,
    footerText: `margin: 0; color: #5f6368; font-size: 14px;`,
    signature: `margin-top: 32px; padding-top: 16px; border-top: 1px solid #e8eaed;`,
    signatureText: `margin: 0; color: #5f6368;`,
    signatureName: `margin: 8px 0 0 0; font-weight: 600; color: #202124;`,
    list: `margin: 0; padding-left: 24px; color: #5f6368;`,
    listItem: `margin-bottom: 12px;`,
  }
}

// Student Welcome Email
const createStudentWelcomeEmail = (data) => {
  const styles = getCommonStyles()
  const schoolLogo = "https://imgur.com/QDQZ0IX.png"

  const content = `
    <div style="${styles.container}">
      <!-- Header -->
      <div style="${styles.header}">
        <img src="${schoolLogo}" alt="School Logo" style="width: 80px; height: auto; margin-bottom: 16px;">
        <h1 style="${styles.headerTitle}">Welcome to NextGen-Pemss</h1>
        <p style="${styles.headerSubtitle}">Your Student Account is Ready</p>
      </div>
  
      <!-- Main Content -->
      <div style="${styles.body}">
        <!-- Greeting -->
        <p style="${styles.greeting}">
          Hello, ${data.fullName || data.name}!
        </p>
        
        <p style="${styles.paragraph}">
          Welcome to NextGen-Pemss! Your student account has been successfully created. Below you'll find your account details and information on how to get started with our school event management system.
        </p>
        
        <!-- Registration Details -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Student Information</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Student ID:</span>
              <span style="${styles.infoValue}">${data.studentId || "Not specified"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Full Name:</span>
              <span style="${styles.infoValue}">${data.fullName || data.name}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Course:</span>
              <span style="${styles.infoValue}">${data.course || "Not specified"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Section:</span>
              <span style="${styles.infoValue}">${data.section || "Not specified"}</span>
            </div>
          </div>
        </div>
  
        <!-- Login Credentials -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Login Credentials</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Username:</span>
              <span style="${styles.infoValue}">${data.username || data.email}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Password:</span>
              <span style="${styles.infoValue}">${data.password}</span>
            </div>
          </div>
          
          <div style="${styles.warningCard}">
            <p style="${styles.warningText}">
              <strong>Important:</strong> For security reasons, please change your password after your first login.
            </p>
          </div>
        </div>
        
        <!-- Next Steps -->
        <h3 style="${styles.sectionTitle}">Getting Started</h3>
        <ol style="${styles.list}">
          <li style="${styles.listItem}">Visit the NextGen-Pemss Portal</li>
          <li style="${styles.listItem}">Log in using your username and password provided above</li>
          <li style="${styles.listItem}">Change your password to ensure account security</li>
          <li style="${styles.listItem}">Complete your student profile if required</li>
          <li style="${styles.listItem}">Browse upcoming school events and register for those you're interested in</li>
        </ol>
        
        <div style="${styles.buttonContainer}">
          <a href="https://nextgenpemss.me/" style="${styles.button}">
            Access Your Account
          </a>
        </div>
        
        <!-- Signature -->
        <div style="${styles.signature}">
          <p style="${styles.signatureText}">If you have any questions, please contact our support team.</p>
          <p style="${styles.signatureText}">Best regards,</p>
          <p style="${styles.signatureName}">NextGen-Pemss Team</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        <p style="${styles.footerText}">© ${new Date().getFullYear()} NextGen-Pemss. All rights reserved.</p>
        <p style="${styles.footerText}">This email was sent to ${data.email}</p>
      </div>
    </div>
  `

  return {
    content,
    subject: "Welcome to NextGen-Pemss - Your Student Account Details",
  }
}

// Teacher Welcome Email
const createTeacherWelcomeEmail = (data) => {
  const styles = getCommonStyles()
  const schoolLogo = "https://imgur.com/QDQZ0IX.png" // Replace with your actual logo URL

  const content = `
    <div style="${styles.container}">
      <!-- Header -->
      <div style="${styles.header}">
        <img src="${schoolLogo}" alt="School Logo" style="width: 80px; height: auto; margin-bottom: 16px;">
        <h1 style="${styles.headerTitle}">Welcome to NextGen-Pemss</h1>
        <p style="${styles.headerSubtitle}">Your Teacher Account is Ready</p>
      </div>
  
      <!-- Main Content -->
      <div style="${styles.body}">
        <!-- Greeting -->
        <p style="${styles.greeting}">
          Hello, ${data.fullName || data.name}!
        </p>
        
        <p style="${styles.paragraph}">
          Welcome to NextGen-Pemss! Your teacher account has been successfully created. Below you'll find your account details and information on how to get started.
        </p>
        
        <!-- Registration Details -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Teacher Information</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Teacher ID:</span>
              <span style="${styles.infoValue}">${data.teacherId || "Not specified"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Full Name:</span>
              <span style="${styles.infoValue}">${data.fullName || data.name}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Department:</span>
              <span style="${styles.infoValue}">${data.department || "Not specified"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Position:</span>
              <span style="${styles.infoValue}">${data.position || "Not specified"}</span>
            </div>
          </div>
        </div>
  
        <!-- Login Credentials -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Login Credentials</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Username:</span>
              <span style="${styles.infoValue}">${data.username || data.email}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Password:</span>
              <span style="${styles.infoValue}">${data.password}</span>
            </div>
          </div>
          
          <div style="${styles.warningCard}">
            <p style="${styles.warningText}">
              <strong>Important:</strong> For security reasons, please change your password after your first login.
            </p>
          </div>
        </div>
        
        <!-- Next Steps -->
        <h3 style="${styles.sectionTitle}">Getting Started</h3>
        <ol style="${styles.list}">
          <li style="${styles.listItem}">Visit the NextGen-Pemss Portal</li>
          <li style="${styles.listItem}">Log in using your username and password provided above</li>
          <li style="${styles.listItem}">Change your password to ensure account security</li>
          <li style="${styles.listItem}">Set up your classes and grade records</li>
        </ol>
        
        <div style="${styles.buttonContainer}">
          <a href="https://nextgenpemss.me/" style="${styles.button}">
            Access Your Account
          </a>
        </div>
        
        <!-- Signature -->
        <div style="${styles.signature}">
          <p style="${styles.signatureText}">If you have any questions, please contact our support team.</p>
          <p style="${styles.signatureText}">Best regards,</p>
          <p style="${styles.signatureName}">NextGen-Pemss Team</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        <p style="${styles.footerText}">© ${new Date().getFullYear()} NextGen-Pemss. All rights reserved.</p>
        <p style="${styles.footerText}">This email was sent to ${data.email}</p>
      </div>
    </div>
  `

  return {
    content,
    subject: "Welcome to NextGen-Pemss - Your Teacher Account Details",
  }
}

// Registrar Welcome Email
const createRegistrarWelcomeEmail = (data) => {
  const styles = getCommonStyles()
  const schoolLogo = "https://imgur.com/QDQZ0IX.png" // Replace with your actual logo URL

  const content = `
    <div style="${styles.container}">
      <!-- Header -->
      <div style="${styles.header}">
        <img src="${schoolLogo}" alt="School Logo" style="width: 80px; height: auto; margin-bottom: 16px;">
        <h1 style="${styles.headerTitle}">Welcome to NextGen-Pemss</h1>
        <p style="${styles.headerSubtitle}">Your Registrar Account is Ready</p>
      </div>
  
      <!-- Main Content -->
      <div style="${styles.body}">
        <!-- Greeting -->
        <p style="${styles.greeting}">
          Hello, ${data.fullName || data.name}!
        </p>
        
        <p style="${styles.paragraph}">
          Welcome to NextGen-Pemss! Your registrar account has been successfully created. Below you'll find your account details and information on how to get started.
        </p>
        
        <!-- Registration Details -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Registrar Information</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Employee ID:</span>
              <span style="${styles.infoValue}">${data.employeeId || "Not specified"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Full Name:</span>
              <span style="${styles.infoValue}">${data.fullName || data.name}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Office:</span>
              <span style="${styles.infoValue}">${data.office || "Not specified"}</span>
            </div>
          </div>
        </div>
  
        <!-- Login Credentials -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Login Credentials</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Username:</span>
              <span style="${styles.infoValue}">${data.username || data.email}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Password:</span>
              <span style="${styles.infoValue}">${data.password}</span>
            </div>
          </div>
          
          <div style="${styles.warningCard}">
            <p style="${styles.warningText}">
              <strong>Important:</strong> For security reasons, please change your password after your first login.
            </p>
          </div>
        </div>
        
        <!-- Next Steps -->
        <h3 style="${styles.sectionTitle}">Getting Started</h3>
        <ol style="${styles.list}">
          <li style="${styles.listItem}">Visit the NextGen-Pemss Portal</li>
          <li style="${styles.listItem}">Log in using your username and password provided above</li>
          <li style="${styles.listItem}">Change your password to ensure account security</li>
          <li style="${styles.listItem}">Begin managing student and course records</li>
        </ol>
        
        <div style="${styles.buttonContainer}">
          <a href="https://nextgenpemss.me/" style="${styles.button}">
            Access Your Account
          </a>
        </div>
        
        <!-- Signature -->
        <div style="${styles.signature}">
          <p style="${styles.signatureText}">If you have any questions, please contact our support team.</p>
          <p style="${styles.signatureText}">Best regards,</p>
          <p style="${styles.signatureName}">NextGen-Pemss Team</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        <p style="${styles.footerText}">© ${new Date().getFullYear()} NextGen-Pemss. All rights reserved.</p>
        <p style="${styles.footerText}">This email was sent to ${data.email}</p>
      </div>
    </div>
  `

  return {
    content,
    subject: "Welcome to NextGen-Pemss - Your Registrar Account Details",
  }
}

// Admin Welcome Email
const createAdminWelcomeEmail = (data) => {
  const styles = getCommonStyles()
  const schoolLogo = "https://imgur.com/QDQZ0IX.png" // Replace with your actual logo URL

  const content = `
    <div style="${styles.container}">
      <!-- Header -->
      <div style="${styles.header}">
        <img src="${schoolLogo}" alt="School Logo" style="width: 80px; height: auto; margin-bottom: 16px;">
        <h1 style="${styles.headerTitle}">Welcome to NextGen-Pemss</h1>
        <p style="${styles.headerSubtitle}">Your Administrator Account is Ready</p>
      </div>
  
      <!-- Main Content -->
      <div style="${styles.body}">
        <!-- Greeting -->
        <p style="${styles.greeting}">
          Hello, ${data.fullName || data.name}!
        </p>
        
        <p style="${styles.paragraph}">
          Welcome to NextGen-Pemss! Your administrator account has been successfully created. Below you'll find your account details and information on how to get started.
        </p>
        
        <!-- Registration Details -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Administrator Information</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Admin ID:</span>
              <span style="${styles.infoValue}">${data.adminId || "Not specified"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Full Name:</span>
              <span style="${styles.infoValue}">${data.fullName || data.name}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Access Level:</span>
              <span style="${styles.infoValue}">${data.accessLevel || "Standard"}</span>
            </div>
          </div>
        </div>
  
        <!-- Login Credentials -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Login Credentials</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Username:</span>
              <span style="${styles.infoValue}">${data.username || data.email}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Password:</span>
              <span style="${styles.infoValue}">${data.password}</span>
            </div>
          </div>
          
          <div style="${styles.warningCard}">
            <p style="${styles.warningText}">
              <strong>Important:</strong> For security reasons, please change your password after your first login.
            </p>
          </div>
        </div>
        
        <!-- Next Steps -->
        <h3 style="${styles.sectionTitle}">Getting Started</h3>
        <ol style="${styles.list}">
          <li style="${styles.listItem}">Visit the NextGen-Pemss Portal</li>
          <li style="${styles.listItem}">Log in using your username and password provided above</li>
          <li style="${styles.listItem}">Change your password to ensure account security</li>
          <li style="${styles.listItem}">Begin managing the system and user accounts</li>
        </ol>
        
        <div style="${styles.buttonContainer}">
          <a href="https://nextgenpemss.me/" style="${styles.button}">
            Access Your Account
          </a>
        </div>
        
        <!-- Signature -->
        <div style="${styles.signature}">
          <p style="${styles.signatureText}">If you have any questions, please contact our support team.</p>
          <p style="${styles.signatureText}">Best regards,</p>
          <p style="${styles.signatureName}">NextGen-Pemss Team</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        <p style="${styles.footerText}">© ${new Date().getFullYear()} NextGen-Pemss. All rights reserved.</p>
        <p style="${styles.footerText}">This email was sent to ${data.email}</p>
      </div>
    </div>
  `

  return {
    content,
    subject: "Welcome to NextGen-Pemss - Your Administrator Account Details",
  }
}

// Generic Welcome Email (fallback if role is unspecified)
const createGenericWelcomeEmail = (data) => {
  const styles = getCommonStyles()
  const schoolLogo = "https://imgur.com/QDQZ0IX.png" // Replace with your actual logo URL

  const content = `
    <div style="${styles.container}">
      <!-- Header -->
      <div style="${styles.header}">
        <img src="${schoolLogo}" alt="School Logo" style="width: 80px; height: auto; margin-bottom: 16px;">
        <h1 style="${styles.headerTitle}">Welcome to NextGen-Pemss</h1>
        <p style="${styles.headerSubtitle}">Your Account is Ready</p>
      </div>
  
      <!-- Main Content -->
      <div style="${styles.body}">
        <!-- Greeting -->
        <p style="${styles.greeting}">
          Hello, ${data.fullName || data.name}!
        </p>
        
        <p style="${styles.paragraph}">
          Welcome to NextGen-Pemss! Your account has been successfully created. Below you'll find your login credentials and information on how to get started.
        </p>
        
        <!-- Login Credentials -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Login Credentials</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Username:</span>
              <span style="${styles.infoValue}">${data.username || data.email}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Password:</span>
              <span style="${styles.infoValue}">${data.password}</span>
            </div>
          </div>
          
          <div style="${styles.warningCard}">
            <p style="${styles.warningText}">
              <strong>Important:</strong> For security reasons, please change your password after your first login.
            </p>
          </div>
        </div>
        
        <!-- Next Steps -->
        <h3 style="${styles.sectionTitle}">Getting Started</h3>
        <ol style="${styles.list}">
          <li style="${styles.listItem}">Visit the NextGen-Pemss Portal</li>
          <li style="${styles.listItem}">Log in using your username and password provided above</li>
          <li style="${styles.listItem}">Change your password to ensure account security</li>
          <li style="${styles.listItem}">Complete your profile information if required</li>
        </ol>
        
        <div style="${styles.buttonContainer}">
          <a href="https://nextgenpemss.me/" style="${styles.button}">
            Access Your Account
          </a>
        </div>
        
        <!-- Signature -->
        <div style="${styles.signature}">
          <p style="${styles.signatureText}">If you have any questions, please contact our support team.</p>
          <p style="${styles.signatureText}">Best regards,</p>
          <p style="${styles.signatureName}">NextGen-Pemss Team</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        <p style="${styles.footerText}">© ${new Date().getFullYear()} NextGen-Pemss. All rights reserved.</p>
        <p style="${styles.footerText}">This email was sent to ${data.email}</p>
      </div>
    </div>
  `

  return {
    content,
    subject: "Welcome to NextGen-Pemss - Your Account Details",
  }
}

// Grade Notification Email
const createGradeNotificationEmail = (data) => {
  const styles = getCommonStyles()
  const schoolLogo = "https://imgur.com/QDQZ0IX.png" // Replace with your actual logo URL

  const content = `
    <div style="${styles.container}">
      <!-- Header -->
      <div style="${styles.header}">
        <img src="${schoolLogo}" alt="School Logo" style="width: 80px; height: auto; margin-bottom: 16px;">
        <h1 style="${styles.headerTitle}">Grade Update Notification</h1>
        <p style="${styles.headerSubtitle}">Your Grades Have Been Updated</p>
      </div>
  
      <!-- Main Content -->
      <div style="${styles.body}">
        <!-- Greeting -->
        <p style="${styles.greeting}">
          Hello, ${data.studentName || data.name}!
        </p>
        
        <p style="${styles.paragraph}">
          We're writing to inform you that your grades have been updated for the following course:
        </p>
        
        <!-- Grade Details -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Course Information</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Course:</span>
              <span style="${styles.infoValue}">${data.courseName || "Not specified"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Course Code:</span>
              <span style="${styles.infoValue}">${data.courseCode || "Not specified"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Instructor:</span>
              <span style="${styles.infoValue}">${data.instructor || "Not specified"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Academic Term:</span>
              <span style="${styles.infoValue}">${data.academicTerm || "Current Term"}</span>
            </div>
          </div>
        </div>
  
        <!-- Grade Update -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Grade Update</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Assignment:</span>
              <span style="${styles.infoValue}">${data.assignmentName || "Not specified"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Grade:</span>
              <span style="${styles.infoValue}">${data.grade || "Not specified"}</span>
            </div>
            
            ${
              data.feedback
                ? `
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Feedback:</span>
              <span style="${styles.infoValue}">${data.feedback}</span>
            </div>
            `
                : ""
            }
            
            ${
              data.currentAverage
                ? `
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Current Average:</span>
              <span style="${styles.infoValue}">${data.currentAverage}</span>
            </div>
            `
                : ""
            }
          </div>
        </div>
        
        <!-- Next Steps -->
        <p style="${styles.paragraph}">
          You can view your complete grade report by logging into your NextGen-Pemss account.
        </p>
        
        <div style="${styles.buttonContainer}">
          <a href="https://nextgenpemss.me/" style="${styles.button}">
            View Your Grades
          </a>
        </div>
        
        <!-- Signature -->
        <div style="${styles.signature}">
          <p style="${styles.signatureText}">If you have any questions about this grade update, please contact your instructor directly.</p>
          <p style="${styles.signatureText}">Best regards,</p>
          <p style="${styles.signatureName}">NextGen-Pemss Team</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        <p style="${styles.footerText}">© ${new Date().getFullYear()} NextGen-Pemss. All rights reserved.</p>
        <p style="${styles.footerText}">This email was sent to ${data.email}</p>
      </div>
    </div>
  `

  return {
    content,
    subject: `Grade Update: ${data.courseName || "Your Course"}`,
  }
}

// Teacher Registration Email
const createTeacherRegistrationEmail = (data) => {
  const styles = getCommonStyles()
  const schoolLogo = "https://imgur.com/QDQZ0IX.png" // Replace with your actual logo URL

  const content = `
    <div style="${styles.container}">
      <!-- Header -->
      <div style="${styles.header}">
        <img src="${schoolLogo}" alt="School Logo" style="width: 80px; height: auto; margin-bottom: 16px;">
        <h1 style="${styles.headerTitle}">Teacher Registration Confirmation</h1>
        <p style="${styles.headerSubtitle}">Your Registration is Being Processed</p>
      </div>
  
      <!-- Main Content -->
      <div style="${styles.body}">
        <!-- Greeting -->
        <p style="${styles.greeting}">
          Hello, ${data.fullName || data.name}!
        </p>
        
        <p style="${styles.paragraph}">
          Thank you for registering as a teacher in the NextGen-Pemss system. Your registration has been received and is currently being processed.
        </p>
        
        <!-- Registration Details -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Registration Information</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Teacher Name:</span>
              <span style="${styles.infoValue}">${data.fullName || data.name}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Email:</span>
              <span style="${styles.infoValue}">${data.email}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Department:</span>
              <span style="${styles.infoValue}">${data.department || "Not specified"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Registration Date:</span>
              <span style="${styles.infoValue}">${new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        
        <!-- Next Steps -->
        <h3 style="${styles.sectionTitle}">What Happens Next</h3>
        <ol style="${styles.list}">
          <li style="${styles.listItem}">Your registration will be reviewed by an administrator</li>
          <li style="${styles.listItem}">Once approved, you will receive your login credentials</li>
          <li style="${styles.listItem}">You can then access the system and set up your courses</li>
        </ol>
        
        <!-- Signature -->
        <div style="${styles.signature}">
          <p style="${styles.signatureText}">If you have any questions, please contact our support team.</p>
          <p style="${styles.signatureText}">Best regards,</p>
          <p style="${styles.signatureName}">NextGen-Pemss Team</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        <p style="${styles.footerText}">© ${new Date().getFullYear()} NextGen-Pemss. All rights reserved.</p>
        <p style="${styles.footerText}">This email was sent to ${data.email}</p>
      </div>
    </div>
  `

  return {
    content,
    subject: "NextGen-Pemss - Teacher Registration Confirmation",
  }
}

// Student Update Email
const createStudentUpdateEmail = (data) => {
  const styles = getCommonStyles()
  const schoolLogo = "https://imgur.com/QDQZ0IX.png" // Replace with your actual logo URL

  const content = `
    <div style="${styles.container}">
      <!-- Header -->
      <div style="${styles.header}">
        <img src="${schoolLogo}" alt="School Logo" style="width: 80px; height: auto; margin-bottom: 16px;">
        <h1 style="${styles.headerTitle}">Student Account Update</h1>
        <p style="${styles.headerSubtitle}">Your Account Information Has Been Updated</p>
      </div>
  
      <!-- Main Content -->
      <div style="${styles.body}">
        <!-- Greeting -->
        <p style="${styles.greeting}">
          Hello, ${data.fullName || data.name}!
        </p>
        
        <p style="${styles.paragraph}">
          We're writing to inform you that your student account has been updated in the NextGen-Pemss system.
        </p>
        
        <!-- Update Information -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Account Updates</h2>
          <div style="${styles.infoGrid}">
            ${
              data.updatedFields
                ? Object.entries(data.updatedFields)
                    .map(
                      ([key, value]) => `
              <div style="${styles.infoRow}">
                <span style="${styles.infoLabel}">${key}:</span>
                <span style="${styles.infoValue}">${value}</span>
              </div>
            `,
                    )
                    .join("")
                : `
              <div style="${styles.infoRow}">
                <span style="${styles.infoLabel}">Update Type:</span>
                <span style="${styles.infoValue}">${data.updateType || "General account update"}</span>
              </div>
            `
            }
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Update Date:</span>
              <span style="${styles.infoValue}">${new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        
        <!-- Next Steps -->
        <p style="${styles.paragraph}">
          Please log in to your account to review these changes and ensure all information is correct.
        </p>
        
        <div style="${styles.buttonContainer}">
          <a href="https://nextgenpemss.me/" style="${styles.button}">
            View Your Account
          </a>
        </div>
        
        <!-- Signature -->
        <div style="${styles.signature}">
          <p style="${styles.signatureText}">If you did not authorize these changes or have any questions, please contact our support team immediately.</p>
          <p style="${styles.signatureText}">Best regards,</p>
          <p style="${styles.signatureName}">NextGen-Pemss Team</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        <p style="${styles.footerText}">© ${new Date().getFullYear()} NextGen-Pemss. All rights reserved.</p>
        <p style="${styles.footerText}">This email was sent to ${data.email}</p>
      </div>
    </div>
  `

  return {
    content,
    subject: "NextGen-Pemss - Student Account Update",
  }
}

// Teacher Update Email
const createTeacherUpdateEmail = (data) => {
  const styles = getCommonStyles()
  const schoolLogo = "https://imgur.com/QDQZ0IX.png" // Replace with your actual logo URL

  const content = `
    <div style="${styles.container}">
      <!-- Header -->
      <div style="${styles.header}">
        <img src="${schoolLogo}" alt="School Logo" style="width: 80px; height: auto; margin-bottom: 16px;">
        <h1 style="${styles.headerTitle}">Teacher Account Update</h1>
        <p style="${styles.headerSubtitle}">Your Account Information Has Been Updated</p>
      </div>
  
      <!-- Main Content -->
      <div style="${styles.body}">
        <!-- Greeting -->
        <p style="${styles.greeting}">
          Hello, ${data.fullName || data.name}!
        </p>
        
        <p style="${styles.paragraph}">
          We're writing to inform you that your teacher account has been updated in the NextGen-Pemss system.
        </p>
        
        <!-- Update Information -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Account Updates</h2>
          <div style="${styles.infoGrid}">
            ${
              data.updatedFields
                ? Object.entries(data.updatedFields)
                    .map(
                      ([key, value]) => `
              <div style="${styles.infoRow}">
                <span style="${styles.infoLabel}">${key}:</span>
                <span style="${styles.infoValue}">${value}</span>
              </div>
            `,
                    )
                    .join("")
                : `
              <div style="${styles.infoRow}">
                <span style="${styles.infoLabel}">Update Type:</span>
                <span style="${styles.infoValue}">${data.updateType || "General account update"}</span>
              </div>
            `
            }
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Update Date:</span>
              <span style="${styles.infoValue}">${new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        
        <!-- Next Steps -->
        <p style="${styles.paragraph}">
          Please log in to your account to review these changes and ensure all information is correct.
        </p>
        
        <div style="${styles.buttonContainer}">
          <a href="https://nextgenpemss.me/" style="${styles.button}">
            View Your Account
          </a>
        </div>
        
        <!-- Signature -->
        <div style="${styles.signature}">
          <p style="${styles.signatureText}">If you did not authorize these changes or have any questions, please contact our support team immediately.</p>
          <p style="${styles.signatureText}">Best regards,</p>
          <p style="${styles.signatureName}">NextGen-Pemss Team</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        <p style="${styles.footerText}">© ${new Date().getFullYear()} NextGen-Pemss. All rights reserved.</p>
        <p style="${styles.footerText}">This email was sent to ${data.email}</p>
      </div>
    </div>
  `

  return {
    content,
    subject: "NextGen-Pemss - Teacher Account Update",
  }
}

// Event Invitation Email
const createEventInvitationEmail = (data) => {
  const styles = getCommonStyles()
  const schoolLogo = "https://imgur.com/QDQZ0IX.png"

  const content = `
    <div style="${styles.container}">
      <!-- Header -->
      <div style="${styles.header}">
        <img src="${schoolLogo}" alt="School Logo" style="width: 80px; height: auto; margin-bottom: 16px;">
        <h1 style="${styles.headerTitle}">Event Invitation</h1>
        <p style="${styles.headerSubtitle}">You're Invited to a School Event</p>
      </div>
  
      <!-- Main Content -->
      <div style="${styles.body}">
        <!-- Greeting -->
        <p style="${styles.greeting}">
          Hello, ${data.fullName || data.name}!
        </p>
        
        <p style="${styles.paragraph}">
          You are cordially invited to attend the following school event:
        </p>
        
        <!-- Event Details -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">${data.eventName || "School Event"}</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Date:</span>
              <span style="${styles.infoValue}">${data.eventDate || "TBA"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Time:</span>
              <span style="${styles.infoValue}">${data.eventTime || "TBA"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Location:</span>
              <span style="${styles.infoValue}">${data.eventLocation || "TBA"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Organizer:</span>
              <span style="${styles.infoValue}">${data.eventOrganizer || "School Administration"}</span>
            </div>
          </div>
          
          ${
            data.eventDescription
              ? `
          <div style="margin-top: 16px;">
            <p style="${styles.paragraph}">${data.eventDescription}</p>
          </div>
          `
              : ""
          }
        </div>
        
        <!-- RSVP Section -->
        <h3 style="${styles.sectionTitle}">RSVP</h3>
        <p style="${styles.paragraph}">
          Please let us know if you'll be attending this event by clicking one of the buttons below:
        </p>
        
        <div style="${styles.buttonContainer}">
          <a href="${data.rsvpYesLink || "https://nextgenpemss.me/events/rsvp?response=yes&eventId=" + (data.eventId || "")}" style="${styles.button}">
            I'll Attend
          </a>
          <a href="${data.rsvpNoLink || "https://nextgenpemss.me/events/rsvp?response=no&eventId=" + (data.eventId || "")}" style="display: inline-block; background: #f8f9fa; color: #5f6368; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600; text-align: center; margin: 8px 0 8px 16px; border: 1px solid #e0e6ed;">
            I Can't Attend
          </a>
        </div>
        
        <!-- Signature -->
        <div style="${styles.signature}">
          <p style="${styles.signatureText}">If you have any questions about this event, please contact the event organizer.</p>
          <p style="${styles.signatureText}">Best regards,</p>
          <p style="${styles.signatureName}">NextGen-Pemss Team</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        <p style="${styles.footerText}">© ${new Date().getFullYear()} NextGen-Pemss. All rights reserved.</p>
        <p style="${styles.footerText}">This email was sent to ${data.email}</p>
      </div>
    </div>
  `

  return {
    content,
    subject: `Invitation: ${data.eventName || "School Event"}`,
  }
}

// Event Reminder Email
const createEventReminderEmail = (data) => {
  const styles = getCommonStyles()
  const schoolLogo = "https://imgur.com/QDQZ0IX.png"

  const content = `
    <div style="${styles.container}">
      <!-- Header -->
      <div style="${styles.header}">
        <img src="${schoolLogo}" alt="School Logo" style="width: 80px; height: auto; margin-bottom: 16px;">
        <h1 style="${styles.headerTitle}">Event Reminder</h1>
        <p style="${styles.headerSubtitle}">Your Upcoming School Event</p>
      </div>
  
      <!-- Main Content -->
      <div style="${styles.body}">
        <!-- Greeting -->
        <p style="${styles.greeting}">
          Hello, ${data.fullName || data.name}!
        </p>
        
        <p style="${styles.paragraph}">
          This is a friendly reminder about the upcoming school event you've registered for:
        </p>
        
        <!-- Event Details -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">${data.eventName || "School Event"}</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Date:</span>
              <span style="${styles.infoValue}">${data.eventDate || "TBA"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Time:</span>
              <span style="${styles.infoValue}">${data.eventTime || "TBA"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Location:</span>
              <span style="${styles.infoValue}">${data.eventLocation || "TBA"}</span>
            </div>
            
            ${
              data.checkInTime
                ? `
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Check-in Time:</span>
              <span style="${styles.infoValue}">${data.checkInTime}</span>
            </div>
            `
                : ""
            }
          </div>
          
          ${
            data.specialInstructions
              ? `
          <div style="margin-top: 16px;">
            <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0; color: #202124;">Special Instructions:</h3>
            <p style="${styles.paragraph}">${data.specialInstructions}</p>
          </div>
          `
              : ""
          }
        </div>
        
        <!-- Calendar Link -->
        <div style="${styles.buttonContainer}">
          <a href="${data.calendarLink || "https://nextgenpemss.me/events/calendar?eventId=" + (data.eventId || "")}" style="${styles.button}">
            Add to Calendar
          </a>
        </div>
        
        <!-- Signature -->
        <div style="${styles.signature}">
          <p style="${styles.signatureText}">If you can no longer attend this event, please update your RSVP on the portal.</p>
          <p style="${styles.signatureText}">Best regards,</p>
          <p style="${styles.signatureName}">NextGen-Pemss Team</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        <p style="${styles.footerText}">© ${new Date().getFullYear()} NextGen-Pemss. All rights reserved.</p>
        <p style="${styles.footerText}">This email was sent to ${data.email}</p>
      </div>
    </div>
  `

  return {
    content,
    subject: `Reminder: ${data.eventName || "School Event"} on ${data.eventDate || "Upcoming"}`,
  }
}

// Event Cancellation Email
const createEventCancellationEmail = (data) => {
  const styles = getCommonStyles()
  const schoolLogo = "https://imgur.com/QDQZ0IX.png"

  const content = `
    <div style="${styles.container}">
      <!-- Header -->
      <div style="${styles.header}">
        <img src="${schoolLogo}" alt="School Logo" style="width: 80px; height: auto; margin-bottom: 16px;">
        <h1 style="${styles.headerTitle}">Event Cancellation Notice</h1>
        <p style="${styles.headerSubtitle}">Important Update About Your Registered Event</p>
      </div>
  
      <!-- Main Content -->
      <div style="${styles.body}">
        <!-- Greeting -->
        <p style="${styles.greeting}">
          Hello, ${data.fullName || data.name}!
        </p>
        
        <p style="${styles.paragraph}">
          We regret to inform you that the following event has been cancelled:
        </p>
        
        <!-- Event Details -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">${data.eventName || "School Event"}</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Originally Scheduled Date:</span>
              <span style="${styles.infoValue}">${data.eventDate || "TBA"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Originally Scheduled Time:</span>
              <span style="${styles.infoValue}">${data.eventTime || "TBA"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Location:</span>
              <span style="${styles.infoValue}">${data.eventLocation || "TBA"}</span>
            </div>
          </div>
          
          ${
            data.cancellationReason
              ? `
          <div style="margin-top: 16px;">
            <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0; color: #202124;">Reason for Cancellation:</h3>
            <p style="${styles.paragraph}">${data.cancellationReason}</p>
          </div>
          `
              : ""
          }
          
          ${
            data.rescheduledDate
              ? `
          <div style="margin-top: 16px; padding: 16px; background-color: #e3fcef; border-radius: 8px; border-left: 4px solid #36b37e;">
            <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0; color: #202124;">Rescheduled Information:</h3>
            <p style="margin: 0; color: #202124;">This event has been rescheduled to ${data.rescheduledDate} at ${data.rescheduledTime || "TBA"}.</p>
          </div>
          `
              : ""
          }
        </div>
        
        <!-- Next Steps -->
        <h3 style="${styles.sectionTitle}">Next Steps</h3>
        ${
          data.rescheduledDate
            ? `
        <p style="${styles.paragraph}">
          Your registration has been automatically transferred to the new date. If you cannot attend on the rescheduled date, please update your RSVP on the portal.
        </p>
        
        <div style="${styles.buttonContainer}">
          <a href="${data.updateRsvpLink || "https://nextgenpemss.me/events/rsvp?eventId=" + (data.eventId || "")}" style="${styles.button}">
            Update RSVP
          </a>
        </div>
        `
            : `
        <p style="${styles.paragraph}">
          We apologize for any inconvenience this may cause. Please check the portal regularly for updates on future events.
        </p>
        
        <div style="${styles.buttonContainer}">
          <a href="https://nextgenpemss.me/events" style="${styles.button}">
            Browse Other Events
          </a>
        </div>
        `
        }
        
        <!-- Signature -->
        <div style="${styles.signature}">
          <p style="${styles.signatureText}">If you have any questions, please contact our events team.</p>
          <p style="${styles.signatureText}">Best regards,</p>
          <p style="${styles.signatureName}">NextGen-Pemss Team</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        <p style="${styles.footerText}">© ${new Date().getFullYear()} NextGen-Pemss. All rights reserved.</p>
        <p style="${styles.footerText}">This email was sent to ${data.email}</p>
      </div>
    </div>
  `

  return {
    content,
    subject: `Cancelled: ${data.eventName || "School Event"} on ${data.eventDate || "Scheduled Date"}`,
  }
}

// Attendance Notification Email Template
const createAttendanceNotificationEmail = (data) => {
  const styles = getCommonStyles()
  const schoolLogo = "https://imgur.com/QDQZ0IX.png" // Replace with your actual logo URL

  // Format date and time for display
  const formattedDate = new Date(data.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  
  const formattedTime = new Date(data.date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })

  // Calculate expiration time if available
  let expirationInfo = ""
  if (data.expiresAt) {
    const expiredDate = new Date(data.expiresAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
    expirationInfo = `<div style="${styles.infoRow}">
      <span style="${styles.infoLabel}">Expires:</span>
      <span style="${styles.infoValue}">${expiredDate}</span>
    </div>`
  }

  const content = `
    <div style="${styles.container}">
      <!-- Header -->
      <div style="${styles.header}">
        <img src="${schoolLogo}" alt="School Logo" style="width: 80px; height: auto; margin-bottom: 16px;">
        <h1 style="${styles.headerTitle}">Attendance Session Created</h1>
        <p style="${styles.headerSubtitle}">Attendance Tracking Notification</p>
      </div>
  
      <!-- Main Content -->
      <div style="${styles.body}">
        <!-- Greeting -->
        <p style="${styles.greeting}">
          Hello, ${data.fullName}!
        </p>
        
        <p style="${styles.paragraph}">
          An attendance session has been successfully created for your class. Students can now scan the QR-CODE generated by Sir/Ma'am ${data.teacherName}.
        </p>
        
        <!-- Attendance Code Card - Highlighted -->
        <div style="${styles.codeCard}">
          <h2 style="${styles.codeTitle}">Attendance Code</h2>
          <p style="${styles.codeValue}">${data.attendanceCode}</p>
        </div>
        
        <!-- Class Details -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Class Information</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Course:</span>
              <span style="${styles.infoValue}">${data.course || "Not specified"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Section:</span>
              <span style="${styles.infoValue}">${data.section || "Not specified"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Room:</span>
              <span style="${styles.infoValue}">${data.room || "Not specified"}</span>
            </div>
          </div>
        </div>
  
        <!-- Session Details -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Session Details</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Date:</span>
              <span style="${styles.infoValue}">${formattedDate}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Created:</span>
              <span style="${styles.infoValue}">${formattedTime}</span>
            </div>
            
            ${expirationInfo}
          </div>
        </div>
        
        <!-- Instructions -->
        <h3 style="${styles.sectionTitle}">Instructions for Students</h3>
        <ol style="${styles.list}">
          <li style="${styles.listItem}">Visit the NextGen-Pemss Portal or open the mobile app</li>
          <li style="${styles.listItem}">Navigate to the "Attendance" section</li>
          <li style="${styles.listItem}">Select the view Details</strong></li>
          <li style="${styles.listItem}">Select the Scan to open the Qr Scanner</li>
          <li style="${styles.listItem}">Scan the Qr that teacher provided</li>
        </ol>
        
        <div style="${styles.buttonContainer}">
          <a href="https://nextgenpemss.me/student/upcoming-attendance" style="${styles.button}">
            View Attendance Dashboard
          </a>
        </div>
        
        <!-- Signature -->
        <div style="${styles.signature}">
          <p style="${styles.signatureText}">If you have any issues with the attendance system, please contact our support team.</p>
          <p style="${styles.signatureText}">Best regards,</p>
          <p style="${styles.signatureName}">NextGen-Pemss Team</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        <p style="${styles.footerText}">© ${new Date().getFullYear()} NextGen-Pemss. All rights reserved.</p>
        <p style="${styles.footerText}">This notification was sent to ${data.email}</p>
      </div>
    </div>
  `

  return {
    content,
    subject: `Attendance Session Created for ${data.course} - ${data.section}`,
  }
}

const createEventRegistrationEmail = (data) => {
  const styles = getCommonStyles()
  const schoolLogo = "https://imgur.com/QDQZ0IX.png"

  // Format date and time for display
  const formattedDate = new Date(data.registeredAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  
  const formattedTime = new Date(data.registeredAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })

  const content = `
    <div style="${styles.container}">
      <!-- Header -->
      <div style="${styles.header}">
        <img src="${schoolLogo}" alt="School Logo" style="width: 80px; height: auto; margin-bottom: 16px;">
        <h1 style="${styles.headerTitle}">Event Registration Confirmed</h1>
        <p style="${styles.headerSubtitle}">NextGen-Pemss Event Notification</p>
      </div>
  
      <!-- Main Content -->
      <div style="${styles.body}">
        <!-- Greeting -->
        <p style="${styles.greeting}">
          Hello, ${data.userName}!
        </p>
        
        <p style="${styles.paragraph}">
          Your registration for the following event has been successfully recorded. Your attendance was processed by ${data.registeredByEmail}.
        </p>
        
        <!-- Registration Info Card - Highlighted -->
        <div style="${styles.codeCard}">
          <h2 style="${styles.codeTitle}">Registration Method</h2>
          <p style="${styles.codeValue}">${data.registrationMethod}</p>
        </div>
        
        <!-- User Details -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Your Information</h2>
          <div style="${styles.infoGrid}">
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Name:</span>
              <span style="${styles.infoValue}">${data.userName}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">ID:</span>
              <span style="${styles.infoValue}">${data.userId}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Course:</span>
              <span style="${styles.infoValue}">${data.course || "Not specified"}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Status:</span>
              <span style="${styles.infoValue}">${data.status}</span>
            </div>
          </div>
        </div>
  
        <!-- Event Details -->
        <div style="${styles.infoCard}">
          <h2 style="${styles.sectionTitle}">Event Details</h2>
          <div style="${styles.infoGrid}">
          <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Event Name:</span>
              <span style="${styles.infoValue}">${data.eventName}</span>
            </div>
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Event ID:</span>
              <span style="${styles.infoValue}">${data.eventId}</span>
            </div>
            
            <div style="${styles.infoRow}">
              <span style="${styles.infoLabel}">Registered At:</span>
              <span style="${styles.infoValue}">${formattedDate} at ${formattedTime}</span>
            </div>
          </div>
        </div>
        
        <div style="${styles.buttonContainer}">
          <a href="https://nextgenpemss.me/events" style="${styles.button}">
            View Your Events
          </a>
        </div>
        
        <!-- Signature -->
        <div style="${styles.signature}">
          <p style="${styles.signatureText}">If you have any questions about this event registration, please contact our support team.</p>
          <p style="${styles.signatureText}">Best regards,</p>
          <p style="${styles.signatureName}">NextGen-Pemss Team</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        <p style="${styles.footerText}">© ${new Date().getFullYear()} NextGen-Pemss. All rights reserved.</p>
        <p style="${styles.footerText}">This notification was sent to ${data.userEmail}</p>
      </div>
    </div>
  `

  return {
    content,
    subject: `Event Registration Confirmed - NextGen-Pemss`,
  }
}
