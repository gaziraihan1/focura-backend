// src/utils/email.ts
export async function sendInvitationEmail(email, invitation) {
    // Use your email service (SendGrid, Resend, etc.)
    const inviteLink = `${process.env.CLIENT_URL}/invitations/${invitation.token}`;
    // Send email with invite link
    console.log(`Send email to ${email}: ${inviteLink}`);
}
//# sourceMappingURL=email.js.map