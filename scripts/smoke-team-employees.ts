import { createRequester, getSmokeCreds, handleMissingCreds, type SmokeCreds } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);
let smokeCreds: SmokeCreds | null = null;

type Member = {
  userId: string;
  email: string;
  role: string;
  employeeProfile?: {
    jobTitle?: string | null;
    status?: string | null;
  } | null;
};

async function login(): Promise<void> {
  let creds;
  try {
    creds = getSmokeCreds({ preferAdmin: true });
    smokeCreds = creds;
  } catch (err) {
    handleMissingCreds((err as Error).message);
    return;
  }
  const { res, json } = await request('/api/auth/login', {
    method: 'POST',
    body: { email: creds.email, password: creds.password },
  });
  if (!res.ok) throw new Error(`Login failed (${res.status}) ${JSON.stringify(json)}`);
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  console.log('Login…');
  await login();

  console.log('Fetch businesses…');
  const { res: bizRes, json: bizJson } = await request('/api/pro/businesses');
  if (!bizRes.ok) throw new Error(`Businesses failed (${bizRes.status})`);
  const businessId =
    (bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id;
  if (!businessId) throw new Error('No business found.');
  console.log(`Business ${businessId}`);

  console.log('Fetch members…');
  const { res: membersRes, json: membersJson } = await request(
    `/api/pro/businesses/${businessId}/members`
  );
  if (!membersRes.ok) throw new Error(`Members failed (${membersRes.status})`);
  const members = (membersJson as { items?: Member[] })?.items ?? [];
  if (!members.length) throw new Error('No members to test.');

  const actorEmail = smokeCreds?.email;
  const target = members.find((m) => m.email !== actorEmail) ?? members[0];
  console.log(`Target member ${target.email}`);
  const jobTitle = `Smoke Employee ${Date.now()}`;

  console.log('PATCH employee profile…');
  const { res: patchRes, json: patchJson } = await request(
    `/api/pro/businesses/${businessId}/members/${target.userId}`,
    {
      method: 'PATCH',
      body: {
        employeeProfile: {
          jobTitle,
          status: 'ACTIVE',
          weeklyHours: 37,
          hourlyCostCents: 4500,
        },
      },
    }
  );
  if (!patchRes.ok) {
    throw new Error(
      `Patch profile failed (${patchRes.status}) body=${JSON.stringify(patchJson)}`
    );
  }
  const patched = (patchJson as { member?: Member })?.member;
  if (!patched?.employeeProfile?.jobTitle || patched.employeeProfile.jobTitle !== jobTitle) {
    throw new Error('Patched profile missing jobTitle');
  }

  console.log('GET member detail…');
  const { res: detailRes, json: detailJson } = await request(
    `/api/pro/businesses/${businessId}/members/${target.userId}`
  );
  if (!detailRes.ok) throw new Error(`Member detail failed (${detailRes.status})`);
  const detail = (detailJson as { member?: Member })?.member;
  if (!detail?.employeeProfile?.jobTitle || detail.employeeProfile.jobTitle !== jobTitle) {
    throw new Error('Detail profile mismatch');
  }

  console.log('Employee smoke OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
