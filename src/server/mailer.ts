import nodemailer from "nodemailer";

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

export const sendOTP = async (email: string, otp: string, type: "login" | "signup"): Promise<boolean> => {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn(`[MAILER] No EMAIL_USER/EMAIL_PASS provided. Printing OTP for ${email}: ${otp}`);
    return true; // Pretend it succeeded for local dev testing
  }

  const subject = type === "signup" ? "Verify your SpendSmart Account" : "Your SpendSmart Login Code";
  const text = `Hello!

Your verification code is: ${otp}

This code will expire in 10 minutes.

Thanks,
The SpendSmart Team`;

  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #1e293b; margin-top: 0;">SpendSmart</h2>
      <p style="color: #475569;">Your verification code is:</p>
      <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; text-align: center; margin: 20px 0;">
        <h1 style="font-size: 32px; letter-spacing: 4px; color: #0f172a; margin: 0;">${otp}</h1>
      </div>
      <p style="color: #64748b; font-size: 14px;">This code will expire in 10 minutes. Please do not share this code with anyone.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"SpendSmart" <${EMAIL_USER}>`,
      to: email,
      subject,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return false;
  }
};

export const sendNotificationEmail = async (email: string, title: string, message: string, type: "info" | "warning" | "success"): Promise<boolean> => {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn(`[MAILER] No EMAIL_USER/EMAIL_PASS. Skipping notification email to ${email}`);
    return true;
  }

  const typeColors = {
    info: "#3b82f6",
    warning: "#ef4444",
    success: "#22c55e",
  };
  const color = typeColors[type] || "#3b82f6";

  const text = `Hello,

${title}
${message}

View your dashboard for more details.

Thanks,
The SpendSmart Team`;

  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; border-top: 4px solid ${color};">
      <h2 style="color: #1e293b; margin-top: 0;">SpendSmart Notification</h2>
      <h3 style="color: ${color};">${title}</h3>
      <p style="color: #475569; line-height: 1.6;">${message}</p>
      <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
        View your <a href="http://localhost:5173/dashboard" style="color: #2563eb; text-decoration: none;">dashboard</a> for more details.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"SpendSmart" <${EMAIL_USER}>`,
      to: email,
      subject: `SpendSmart Update: ${title}`,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error("Error sending Notification email:", error);
    return false;
  }
};

export const sendWelcomeEmail = async (email: string, name: string): Promise<boolean> => {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn(`[MAILER] No EMAIL_USER/EMAIL_PASS. Skipping welcome email to ${email}`);
    return true;
  }

  const subject = "Welcome to SpendSmart!";
  const text = `Hi ${name},

Welcome to SpendSmart! Your account has been successfully created.
We are excited to help you take control of your finances and reach your savings goals.

Head over to your dashboard to set up your first budget!

Best,
The SpendSmart Team`;

  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; border-top: 4px solid #22c55e;">
      <h2 style="color: #1e293b; margin-top: 0;">Welcome to SpendSmart!</h2>
      <p style="color: #475569; line-height: 1.6;">Hi ${name},</p>
      <p style="color: #475569; line-height: 1.6;">Your account has been successfully created. We are excited to help you take control of your finances and reach your savings goals.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="http://localhost:5173/dashboard" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Dashboard</a>
      </div>
      <p style="color: #64748b; font-size: 14px; margin-top: 30px;">Best,<br/>The SpendSmart Team</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"SpendSmart" <${EMAIL_USER}>`,
      to: email,
      subject,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error("Error sending Welcome email:", error);
    return false;
  }
};

export const sendDailySummaryEmail = async (
  email: string,
  name: string,
  totalSpentToday: number,
  expenses: { category: string; amount: number; description: string }[],
  remainingBudget: number
): Promise<boolean> => {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn(`[MAILER] No EMAIL_USER/EMAIL_PASS. Skipping daily summary email to ${email}`);
    return true;
  }

  const subject = "Your Daily SpendSmart Summary";
  const dateStr = new Date().toLocaleDateString("en-IN", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  let expenseListHtml = "";
  if (expenses.length > 0) {
    expenseListHtml = expenses.map(e => 
      `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${e.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-transform: capitalize;">${e.category}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${e.amount}</td>
      </tr>`
    ).join("");
  } else {
    expenseListHtml = `<tr><td colspan="3" style="padding: 8px; text-align: center; color: #64748b;">No expenses recorded today. Great job!</td></tr>`;
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; border-top: 4px solid #0f172a;">
      <h2 style="color: #1e293b; margin-top: 0;">Daily Summary: ${dateStr}</h2>
      <p style="color: #475569; line-height: 1.6;">Hi ${name},</p>
      <p style="color: #475569; line-height: 1.6;">Here is a quick breakdown of your spending today:</p>
      
      <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="margin: 0; color: #64748b; font-size: 14px; text-transform: uppercase; tracking: 1px;">Total Spent Today</p>
        <h1 style="margin: 8px 0 0 0; color: #ef4444; font-size: 36px;">₹${totalSpentToday}</h1>
      </div>

      <h3 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Today's Transactions</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px; color: #334155;">
        <thead>
          <tr>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #64748b;">Description</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #64748b;">Category</th>
            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #e2e8f0; color: #64748b;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${expenseListHtml}
        </tbody>
      </table>

      <div style="background-color: ${remainingBudget > 0 ? '#f0fdf4' : '#fef2f2'}; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid ${remainingBudget > 0 ? '#bbf7d0' : '#fecaca'};">
        <h3 style="margin: 0 0 8px 0; color: ${remainingBudget > 0 ? '#166534' : '#991b1b'};">Monthly Budget Update</h3>
        <p style="margin: 0; color: ${remainingBudget > 0 ? '#15803d' : '#b91c1c'}; font-size: 16px;">
          You have <strong>₹${remainingBudget > 0 ? remainingBudget : 0}</strong> left for the rest of the month.
        </p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="http://localhost:5173/dashboard" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Dashboard</a>
      </div>
      <p style="color: #64748b; font-size: 14px; margin-top: 30px; text-align: center;">Best,<br/>The SpendSmart Team</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"SpendSmart" <${EMAIL_USER}>`,
      to: email,
      subject,
      text: "Please view this email in an HTML compatible client.",
      html,
    });
    return true;
  } catch (error) {
    console.error("Error sending daily summary email:", error);
    return false;
  }
};

export const sendMonthlySummaryEmail = async (
  email: string,
  name: string,
  monthName: string,
  totalSpent: number,
  savingsGoal: number,
  actualSavings: number,
  categoryBreakdown: { category: string; amount: number }[]
): Promise<boolean> => {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn(`[MAILER] No EMAIL_USER/EMAIL_PASS. Skipping monthly summary email to ${email}`);
    return true;
  }

  const subject = `Your Monthly SpendSmart Summary: ${monthName}`;
  
  let categoryHtml = "";
  if (categoryBreakdown.length > 0) {
    categoryHtml = categoryBreakdown.map(c => 
      `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-transform: capitalize;">${c.category}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${c.amount}</td>
      </tr>`
    ).join("");
  } else {
    categoryHtml = `<tr><td colspan="2" style="padding: 8px; text-align: center; color: #64748b;">No expenses recorded this month.</td></tr>`;
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; border-top: 4px solid #6366f1;">
      <h2 style="color: #1e293b; margin-top: 0;">Monthly Review: ${monthName}</h2>
      <p style="color: #475569; line-height: 1.6;">Hi ${name},</p>
      <p style="color: #475569; line-height: 1.6;">Your financial summary for ${monthName} is ready!</p>
      
      <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="margin: 0; color: #64748b; font-size: 14px; text-transform: uppercase; tracking: 1px;">Total Spent</p>
        <h1 style="margin: 8px 0 0 0; color: #1e293b; font-size: 36px;">₹${totalSpent}</h1>
      </div>

      <div style="background-color: ${actualSavings >= savingsGoal ? '#f0fdf4' : '#fef2f2'}; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid ${actualSavings >= savingsGoal ? '#bbf7d0' : '#fecaca'};">
        <h3 style="margin: 0 0 8px 0; color: ${actualSavings >= savingsGoal ? '#166534' : '#991b1b'};">Savings Goal</h3>
        <p style="margin: 0; color: ${actualSavings >= savingsGoal ? '#15803d' : '#b91c1c'}; font-size: 16px;">
          Goal: ₹${savingsGoal} | Saved: ₹${actualSavings}
          <br/>
          <strong>${actualSavings >= savingsGoal ? "Awesome job hitting your goal! 🎉" : "You missed your goal this month. Let's try again next month! 💪"}</strong>
        </p>
      </div>

      <h3 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Spending by Category</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px; color: #334155;">
        <thead>
          <tr>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #64748b;">Category</th>
            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #e2e8f0; color: #64748b;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${categoryHtml}
        </tbody>
      </table>

      <div style="text-align: center; margin: 30px 0;">
        <a href="http://localhost:5173/dashboard" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Full Dashboard</a>
      </div>
      <p style="color: #64748b; font-size: 14px; margin-top: 30px; text-align: center;">Best,<br/>The SpendSmart Team</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"SpendSmart" <${EMAIL_USER}>`,
      to: email,
      subject,
      text: "Please view this email in an HTML compatible client.",
      html,
    });
    return true;
  } catch (error) {
    console.error("Error sending monthly summary email:", error);
    return false;
  }
};
