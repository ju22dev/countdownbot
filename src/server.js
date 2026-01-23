import { Telegraf, Markup } from "telegraf";
import { message } from "telegraf/filters";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.BOT_TOKEN
const bot = new Telegraf(token)

const countdowns = [
    { "name": "Chelsea", "date": "2026-01-25" }
]

bot.start((ctx) => {
    const welcome = `Hi ${ctx.chat.first_name}! I'm Countdown Bot and I'll help you with counting down to things that matter. Just click one of the buttons below 😎`;
    ctx.reply(
        welcome,
        Markup.keyboard([
            ["⏰ Show me my countdowns"],
            ["➕ Add countdown"],
            ["✏️ Edit countdown"],
            ["❌ Remove countdown"],
            ["☑️ Enable daily reminders"],
            ["🛠 Options"],
            ["🇬🇧 Change language"],
            ["ℹ️ About"]
        ]).resize()
    );
})

bot.hears(/Show me my countdowns/, (ctx) => {
    let countdownMsg = ""
    countdowns.forEach((cntdn, i) => {
        let delta = Date.parse(cntdn.date) - Date.now()
        const MS_PER_DAY = 1000 * 60 * 60 * 24;
        
        if (delta > 0) {
            const days = Math.ceil(Math.abs(delta) / MS_PER_DAY);
            delta = `${days} days left`
        } else if (delta < -1000 * 60 * 60 * 24) {
            const days = Math.floor(Math.abs(delta) / MS_PER_DAY);
            delta = `${days} days ago`
        } else {
            delta = "IT'S TODAY!"
        }
        countdownMsg += `${cntdn.name}\n(${cntdn.date}) \n${delta}\n`
    })
    ctx.reply(
        countdownMsg,
        Markup.keyboard([
            ["⏰ Show me my countdowns"],
            ["➕ Add countdown"],
            ["✏️ Edit countdown"],
            ["❌ Remove countdown"],
            ["☑️ Enable daily reminders"],
            ["🛠 Options"],
            ["🇬🇧 Change language"],
            ["ℹ️ About"]
        ]).resize()
    );
});

bot.hears(/Add countdown/, (ctx) => {
    ctx.reply("hello there");
});

bot.hears(/Edit countdown/, (ctx) => {
    ctx.reply("hello there");
});

bot.hears(/Remove countdown/, (ctx) => {
    ctx.reply("hello there");
});

bot.hears(/Enable daily reminders/, (ctx) => {
    ctx.reply("hello there");
});

bot.hears(/Options/, (ctx) => {
    ctx.reply("hello there");
});

bot.hears(/Change language/, (ctx) => {
    ctx.reply("hello there");
});

bot.hears(/About/, (ctx) => {
    ctx.reply("hello there");
});

bot.launch();