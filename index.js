import { Telegraf, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { bold, italic, fmt } from "telegraf/format";
import prisma from "./src/prismaClient.js";

const token = process.env.BOT_TOKEN;
const bot = new Telegraf(token);

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const mainMenu = Markup.keyboard([
  ["⏰ Show me my countdowns"],
  ["➕ Add countdown"],
  ["✏️ Edit countdown"],
  ["❌ Remove countdown"],
  ["☑️ Enable daily reminders"],
  ["🛠 Options"],
  ["🇬🇧 Change language"],
  ["ℹ️ About"],
]).resize();

// ---------- helpers ----------

function formatDelta(dateStr) {
  const target = Date.parse(dateStr);
  const delta = target - Date.now();
  if (delta > 0) {
    return `${Math.ceil(delta / MS_PER_DAY)} days left`;
  } else if (delta < -MS_PER_DAY) {
    return `${Math.floor(Math.abs(delta) / MS_PER_DAY)} days ago`;
  }
  return "IT'S TODAY!";
}

// Loads (or creates) the user row so we always have somewhere to store state.
async function getOrCreateUser(ctx) {
  const chatId = ctx.chat.id.toString();
  let user = await prisma.user.findUnique({ where: { chatId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        username: ctx.chat.username || ctx.chat.first_name || `user_${chatId}`,
        chatId,
      },
    });
  }
  return user;
}

async function setState(chatId, data) {
  await prisma.user.update({
    where: { chatId },
    data,
  });
}

async function resetState(chatId) {
  await setState(chatId, { step: "", tempName: null, selectedCountdown: null });
}

// ---------- command / button handlers ----------

bot.start(async (ctx) => {
  try {
    await getOrCreateUser(ctx);
  } catch (err) {
    console.log(err.message);
  }

  const welcome = `I'm Countdown Bot and I'll help you with counting down to things that matter. Just click one of the buttons below 😎`;
  await ctx.reply(fmt(bold(`Hi ${ctx.chat.first_name}! \n`), welcome), mainMenu);

  await resetState(ctx.chat.id.toString());
});

bot.hears(/Show me my countdowns/, async (ctx) => {
  try {
    const user = await prisma.user.findUnique({
      where: { chatId: ctx.chat.id.toString() },
      include: { countdowns: { orderBy: { date: "asc" } } },
    });

    const userData = user?.countdowns ?? [];
    if (userData.length === 0) {
      await ctx.reply("You don't have any countdown.");
      return;
    }

    const countdownMsg = [];
    const pastCtdns = [];

    userData.forEach((cntdn) => {
      const delta = Date.parse(cntdn.date) - Date.now();
      const line = [bold(`${cntdn.name}\n`), italic(`(${cntdn.date})\n`)];
      if (delta > 0) {
        line.push(`${Math.ceil(Math.abs(delta) / MS_PER_DAY)} days left`, "\n\n");
        countdownMsg.push(...line);
      } else if (delta < -MS_PER_DAY) {
        line.push(`${Math.floor(Math.abs(delta) / MS_PER_DAY)} days ago`, "\n\n");
        pastCtdns.push(...line);
      } else {
        line.push("IT'S TODAY!", "\n\n");
        countdownMsg.push(...line);
      }
    });

    countdownMsg.push("___________________\n");
    countdownMsg.push(...pastCtdns);

    await ctx.reply(fmt(countdownMsg));
    await resetState(ctx.chat.id.toString());
  } catch (e) {
    console.log(e.message);
  }
});

bot.hears(/Add countdown/, async (ctx) => {
  await setState(ctx.chat.id.toString(), { step: "Add Name" });
  await ctx.reply("Send me the name of your countdown:");
});

bot.hears(/Edit countdown/, async (ctx) => {
  try {
    const countdowns = await prisma.countdowns.findMany({
      where: { user: { chatId: ctx.chat.id.toString() } },
      orderBy: { date: "asc" },
    });

    if (countdowns.length === 0) {
      await ctx.reply("You don't have any countdown to edit.");
      return;
    }

    const keyboard = countdowns.map((c) => [`${c.name}, ${c.date}`]);

    await ctx.reply(
      "Which countdown do you want to edit?",
      Markup.keyboard(keyboard).resize()
    );
    await setState(ctx.chat.id.toString(), { step: "Choose countdown" });
  } catch (e) {
    console.log(e.message);
  }
});

bot.hears(/Remove countdown/, async (ctx) => {
  try {
    const countdowns = await prisma.countdowns.findMany({
      where: { user: { chatId: ctx.chat.id.toString() } },
      orderBy: { date: "asc" },
    });

    if (countdowns.length === 0) {
      await ctx.reply("You don't have any countdown to remove.");
      return;
    }

    const keyboard = countdowns.map((c) => [`${c.name}, ${c.date}`]);

    await ctx.reply(
      "Which countdown do you want to delete?",
      Markup.keyboard(keyboard).resize()
    );
    await setState(ctx.chat.id.toString(), { step: "Remove countdown" });
  } catch (e) {
    console.log(e.message);
  }
});

bot.hears(/Enable daily reminders/, async (ctx) => {
  await ctx.reply(fmt(bold("Hello"), italic("there")));
});

bot.hears(/Options/, async (ctx) => {
  await ctx.reply("hello there");
});

bot.hears(/Change language/, async (ctx) => {
  await ctx.reply("hello there");
});

bot.hears(/About/, async (ctx) => {
  await ctx.reply("hello there");
});

// ---------- multi-step text flows (Add / Edit / Remove) ----------

bot.on(message("text"), async (ctx) => {
  const chatId = ctx.chat.id.toString();

  let user;
  try {
    user = await getOrCreateUser(ctx);
  } catch (e) {
    console.log(e.message);
    return;
  }

  const step = user.step || "";

  // --- Add countdown flow ---

  if (step === "Add Name") {
    await setState(chatId, { step: "Add Date", tempName: ctx.message.text });
    await ctx.reply(
      `Now send me the date (YYYY-MM-DD), e.g. ${new Date().toISOString().slice(0, 10)}`
    );
    return;
  }

  if (step === "Add Date") {
    const dateStr = ctx.message.text;
    if (isNaN(Date.parse(dateStr))) {
      await ctx.reply("❌ Invalid date. Use YYYY-MM-DD");
      return;
    }

    const name = user.tempName;
    try {
      await prisma.countdowns.create({
        data: {
          name,
          date: dateStr,
          user: { connect: { chatId } },
        },
      });
    } catch (e) {
      console.log(e.message);
      return;
    }

    await ctx.reply(`${name}\n(${dateStr})\n${formatDelta(dateStr)}`, mainMenu);
    await resetState(chatId);
    return;
  }

  // --- Edit countdown flow ---

  if (step === "Choose countdown") {
    const selected = ctx.message.text.split(",")[0].trim();
    await setState(chatId, { step: "Edit name or date", selectedCountdown: selected });
    await ctx.reply(
      "What do you want to change?",
      Markup.keyboard([["Edit name"], ["Edit date"], ["🔙 Cancel"]]).resize()
    );
    return;
  }

  if (step === "Edit name or date") {
    const choice = ctx.message.text;
    if (choice === "Edit name") {
      await setState(chatId, { step: "Set name" });
      await ctx.reply("What do you want to change the name to?");
      return;
    }
    if (choice === "Edit date") {
      await setState(chatId, { step: "Set date" });
      await ctx.reply(
        `What do you want to change the date to? Send me the date (YYYY-MM-DD), e.g. ${new Date()
          .toISOString()
          .slice(0, 10)}`
      );
      return;
    }
    if (choice === "🔙 Cancel") {
      await ctx.reply("Cancelled.", mainMenu);
      await resetState(chatId);
      return;
    }
    return;
  }

  if (step === "Set name") {
    const newName = ctx.message.text;
    const selected = user.selectedCountdown;

    try {
      await prisma.countdowns.updateMany({
        where: { name: selected, user: { chatId } },
        data: { name: newName },
      });
    } catch (e) {
      console.log(e.message);
      return;
    }

    let updated;
    try {
      updated = await prisma.countdowns.findFirst({
        where: { name: newName, user: { chatId } },
      });
    } catch (e) {
      console.log(e.message);
      return;
    }

    await ctx.reply(
      `${newName}\n(${updated.date})\n${formatDelta(updated.date)}`,
      mainMenu
    );
    await resetState(chatId);
    return;
  }

  if (step === "Set date") {
    const newDate = ctx.message.text;
    if (isNaN(Date.parse(newDate))) {
      await ctx.reply("❌ Invalid date. Use YYYY-MM-DD");
      return;
    }

    const selected = user.selectedCountdown;
    try {
      await prisma.countdowns.updateMany({
        where: { name: selected, user: { chatId } },
        data: { date: newDate },
      });
    } catch (e) {
      console.log(e.message);
      return;
    }

    await ctx.reply(`${selected}\n(${newDate})\n${formatDelta(newDate)}`, mainMenu);
    await resetState(chatId);
    return;
  }

  // --- Remove countdown flow ---

  if (step === "Remove countdown") {
    const selected = ctx.message.text.split(",")[0].trim();
    try {
      await prisma.countdowns.deleteMany({
        where: { name: selected, user: { chatId } },
      });
    } catch (e) {
      console.log(e.message);
      return;
    }

    await ctx.reply("Countdown was deleted", mainMenu);
    await resetState(chatId);
    return;
  }
});

// ---------- Vercel serverless entry point ----------

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      await bot.handleUpdate(req.body, res);
      if (!res.writableEnded) {
        res.status(200).end();
      }
    } catch (e) {
      console.error(e);
      if (!res.writableEnded) {
        res.status(500).end();
      }
    }
  } else {
    res.status(200).send("Bot is running");
  }
}
