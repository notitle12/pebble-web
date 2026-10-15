import { PolicyDocument } from "@/features/legal/components/policy-document";
import { PrivacyContent } from "@/features/legal/components/privacy-content";
import { legalVersions } from "@/features/legal/policy";
export const metadata={title:"개인정보 처리방침"};
export const dynamic="force-dynamic";
export default function Page(){return <PolicyDocument title="개인정보 처리방침" version={legalVersions.privacyVersion}><PrivacyContent/></PolicyDocument>}
