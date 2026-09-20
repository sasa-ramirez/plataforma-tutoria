// Detecta correos mal escritos en el dominio (uni.edu.co, unigujira.edu.co,
// gmial.com…) para avisar antes de crear la cuenta: un correo con el dominio
// errado nunca recibe el mensaje de confirmación.

export const INSTITUTIONAL_DOMAIN = "uniguajira.edu.co";

const COMMON_DOMAINS = [
  INSTITUTIONAL_DOMAIN,
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "live.com",
];

function distance(a: string, b: string): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Si el dominio parece un error de escritura, devuelve el correo corregido. */
export function suggestEmailDomain(email: string): string | null {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return null;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (!domain || COMMON_DOMAINS.includes(domain)) return null;

  // Correos de la universidad: «edu.co» solo, «uni.edu.co», «unigujira.edu.co»…
  if (domain === "edu.co" || domain.endsWith(".edu.co")) {
    const label = domain === "edu.co" ? "" : domain.slice(0, -".edu.co".length);
    const target = INSTITUTIONAL_DOMAIN.slice(0, -".edu.co".length);
    const looksLikeIt =
      label === "" ||
      (label.length >= 3 && target.startsWith(label)) ||
      distance(label, target) <= 3;
    return looksLikeIt ? `${local}@${INSTITUTIONAL_DOMAIN}` : null;
  }

  // Dominios comunes con una o dos letras cambiadas (gmial.com → gmail.com).
  for (const known of COMMON_DOMAINS) {
    if (known !== INSTITUTIONAL_DOMAIN && distance(domain, known) <= 2) {
      return `${local}@${known}`;
    }
  }
  return null;
}
