export async function sendInvitationEmail(email: string, invitation: any) {
  const inviteLink = `${process.env.CLIENT_URL}/invitations/${invitation.token}`;

  console.log(`Send email to ${email}: ${inviteLink}`);
}