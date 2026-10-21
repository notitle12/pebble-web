import { PolicyDocument } from "@/features/legal/components/policy-document";
import { TermsContent } from "@/features/legal/components/terms-content";
import { legalVersions } from "@/features/legal/policy";
export const metadata={title:"이용약관"};
export const dynamic="force-dynamic";
export default function Page(){return <PolicyDocument title="이용약관" version={legalVersions.termsVersion}><TermsContent/></PolicyDocument>}
