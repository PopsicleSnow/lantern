'use client';

import dynamic from 'next/dynamic';

const TipSubmissionForm = dynamic(() => import('@/components/TipSubmissionForm'), {
  ssr: false,
});

export default function SubmitPage() {
  return <TipSubmissionForm />;
}
