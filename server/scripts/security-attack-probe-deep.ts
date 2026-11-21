/** เทสโจมตีชั้นลึก — IDOR write / consent / alert */
const BASE = process.env.ATTACK_BASE_URL || "http://127.0.0.1:5000";
const PASS = "NucareTest!2026";

const cookieFrom = (res: Response): string => {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  const list =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : [];
  return list.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
};

async function login(identifier: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify({ identifier, password: PASS }),
  });
  return { status: res.status, cookie: cookieFrom(res), json: await res.json() };
}

async function main() {
  const a1 = await login("advisor1.example@nucare.local");
  const a2 = await login("advisor2.example@nucare.local");
  const st1 = await login("student1.example@nucare.local");
  const st2 = await login("student2.example@nucare.local");

  console.log("login", {
    a1: a1.status,
    a2: a2.status,
    st1: st1.status,
    st2: st2.status,
  });

  const l1 = await (
    await fetch(`${BASE}/api/advisor/students`, {
      headers: { Cookie: a1.cookie },
    })
  ).json();
  const l2 = await (
    await fetch(`${BASE}/api/advisor/students`, {
      headers: { Cookie: a2.cookie },
    })
  ).json();
  const s1 = (l1.students || []) as Array<{ id: string }>;
  const s2 = (l2.students || []) as Array<{ id: string }>;
  const foreign = s2.find((s) => !s1.some((x) => x.id === s.id));
  console.log("foreignStudent", foreign?.id || null, "counts", s1.length, s2.length);

  if (foreign) {
    const ref = await fetch(
      `${BASE}/api/advisor/students/${foreign.id}/referrals`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: a1.cookie,
        },
        body: JSON.stringify({
          target: "COUNSELING_CENTER",
          reason: "ATTACK_PROBE_REASON_SHOULD_BE_DENIED_XXXX",
          isUrgent: false,
        }),
      }
    );
    console.log("A9_referral_IDOR", ref.status, (await ref.text()).slice(0, 180));

    const care = await fetch(
      `${BASE}/api/advisor/students/${foreign.id}/care-records`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: a1.cookie,
        },
        body: JSON.stringify({
          careDate: new Date().toISOString(),
          careType: "probe",
          topic: "attack topic probe line",
          action: "should fail IDOR",
          outcome: "x",
        }),
      }
    );
    console.log("A21_care_IDOR", care.status, (await care.text()).slice(0, 180));

    // mass assignment on OWN student care record
    const own = s1[0];
    if (own) {
      const careMass = await fetch(
        `${BASE}/api/advisor/students/${own.id}/care-records`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3000",
            Cookie: a1.cookie,
          },
          body: JSON.stringify({
            careDate: new Date().toISOString().slice(0, 10),
            careType: "probe-mass",
            topic: "mass assignment probe topic",
            action: "extra fields should be rejected",
            outcome: "ok",
            advisorId: "hijack-advisor",
            studentId: foreign.id,
            isUrgent: true,
          }),
        }
      );
      console.log(
        "A22_care_mass_assign",
        careMass.status,
        (await careMass.text()).slice(0, 220)
      );
    }
  }

  const cons = await fetch(`${BASE}/api/consent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify({
      anonymousId: "abcd1234probe99",
      status: "necessary_only",
      analytics: false,
      policyVersion: "2026-09-08",
      userId: "hijack-user-id",
    }),
  });
  console.log("A23_consent_extra_fields", cons.status, (await cons.text()).slice(0, 180));

  const alertsRes = await fetch(`${BASE}/api/alerts/me`, {
    headers: { Cookie: st2.cookie },
  });
  const alertsJson = (await alertsRes.json()) as {
    alerts?: Array<{ id: string }>;
  };
  const otherAlert = alertsJson.alerts?.[0];
  console.log(
    "st2_alerts",
    alertsRes.status,
    alertsJson.alerts?.length ?? 0
  );
  if (otherAlert) {
    const ack = await fetch(
      `${BASE}/api/alerts/${otherAlert.id}/acknowledge`,
      {
        method: "PATCH",
        headers: {
          Origin: "http://localhost:3000",
          Cookie: st1.cookie,
        },
      }
    );
    console.log("A24_alert_IDOR", ack.status, (await ack.text()).slice(0, 120));
  } else {
    console.log("A24_alert_IDOR SKIP no alerts for student2");
  }

  // MH tries to update fake referral with extra fields
  const mh = await login("mh1.example@nucare.local");
  const mhUp = await fetch(
    `${BASE}/api/mental-health/referrals/clfake000000000000000000/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        Cookie: mh.cookie,
      },
      body: JSON.stringify({
        status: "ACCEPTED",
        acceptedByUserId: mh.json?.user?.id,
        role: "ADMIN",
      }),
    }
  );
  console.log(
    "A25_mh_referral_mass",
    mhUp.status,
    (await mhUp.text()).slice(0, 180)
  );

  // executive path as advisor
  const exec = await fetch(`${BASE}/api/executive/dashboard`, {
    headers: { Cookie: a1.cookie },
  });
  console.log("A26_advisor_to_exec", exec.status, (await exec.text()).slice(0, 100));

  // student open chat with another student (should fail)
  const chat = await fetch(`${BASE}/api/chat/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      Cookie: st1.cookie,
    },
    body: JSON.stringify({ peerUserId: (st2.json as { user?: { id?: string } }).user?.id }),
  });
  console.log("A27_student_chat_student", chat.status, (await chat.text()).slice(0, 180));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
