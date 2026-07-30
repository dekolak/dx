import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Seed idempotent : crée l'organisation + l'utilisateur initial (Teddy) à partir
// des variables d'environnement. Rejouable sans dupliquer.
const prisma = new PrismaClient();

async function main() {
  const orgName = process.env.SEED_ORG_NAME || "DTS Conception";
  const email = (process.env.SEED_USER_EMAIL || "teddy@example.com").toLowerCase();
  const password = process.env.SEED_USER_PASSWORD || "change-me";

  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    console.log(`Utilisateur déjà présent : ${email} (org ${user.organizationId})`);
    return;
  }

  const org = await prisma.organization.create({ data: { name: orgName } });
  const passwordHash = await bcrypt.hash(password, 10);
  user = await prisma.user.create({
    data: { organizationId: org.id, email, name: "Teddy", passwordHash, role: "owner" },
  });

  console.log(`Organisation créée : ${org.name} (${org.id})`);
  console.log(`Utilisateur créé   : ${email}`);
  if (password === "change-me") {
    console.warn("⚠️  Mot de passe par défaut « change-me » — changez SEED_USER_PASSWORD !");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
