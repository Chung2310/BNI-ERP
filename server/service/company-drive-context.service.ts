import { google } from "googleapis";

export async function getCompanyDriveContext(companyCode: string) {
  const { CompanyModel } = await import("../model/company.model");
  const company = await CompanyModel.findOne({ code: companyCode.toUpperCase() });

  if (company && company.driveOAuth?.refreshToken) {
    const { googleOAuthService } = await import("../service/google-oauth.service");
    const accessToken = await googleOAuthService.getAccessToken(company.driveOAuth.refreshToken);
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: company.driveOAuth.refreshToken
    });

    if (!company.driveFolderId) {
      const { googleDriveService } = await import("../service/google-drive.service");
      const folder = await googleDriveService.createFolder(
        accessToken,
        `iGen Connect - Tài liệu ${company.name || company.code}`
      );
      company.driveFolderId = folder.id;
      company.driveFolderLink = folder.webViewLink || "";
      await company.save();
    }

    return {
      authClient: oauth2Client,
      rootFolderId: company.driveFolderId,
      isConnected: true,
      email: company.driveOAuth.connectedEmail || "Company Google Drive",
      isCompanyDrive: true
    };
  }

  return {
    authClient: null,
    rootFolderId: "",
    isConnected: false,
    email: "",
    isCompanyDrive: false
  };
}

