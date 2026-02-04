import { Telegraf, Markup, session } from "telegraf";
import { message } from "telegraf/filters";
import dotenv from "dotenv";
import prisma from './src/prismaClient.js'
import { bold, italic, fmt } from "telegraf/format";
dotenv.config();

const token = process.env.BOT_TOKEN
const bot = new Telegraf(token)
bot.use(session());

let step = "";
let ctdn = {};
let selectedCountdown = ""

bot.start(async (ctx) => {

    try {
        const user = await prisma.user.create({
            data: {
                username: ctx.chat.username || ctx.chat.first_name,
                chatId: ctx.chat.id.toString()
            }

        })
        const welcome = `I'm Countdown Bot and I'll help you with counting down to things that matter. Just click one of the buttons below 😎`;
        ctx.reply(
            fmt(
                bold(`Hi ${ctx.chat.first_name}! \n`),
                welcome
            ),
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
        console.log(ctx.message.text)
        step = ""
        selectedCountdown = ""
        ctdn = {}
    } catch (err) {
        console.log(err.message)
    }


})

bot.hears(/Show me my countdowns/, async (ctx) => {
    let userData;
    try {
        const user = await prisma.user.findMany({
            include: {
                countdowns: {
                    orderBy: {
                        date: 'asc',
                    },
                }
            },
            where: { chatId: ctx.chat.id.toString() }
        })

        userData = user[0].countdowns
        if (userData.length === 0) {
            ctx.reply("You don't have any countdown.")
            return;
        }
        let countdownMsg = []
        userData.forEach((cntdn, i) => {
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
            countdownMsg.push(bold(`${cntdn.name}\n`), italic(`(${cntdn.date})\n`), delta, "\n\n")
        })

        ctx.reply(fmt(countdownMsg));
        step = ""
        selectedCountdown = ""
        ctdn = {}

    } catch (e) {
        console.log(e.message)
        return;
    }

});

bot.hears(/Add countdown/, (ctx) => {

    step = "Add Name"
    ctx.reply("Send me the name of your countdown:");
});

bot.hears(/Edit countdown/, async (ctx) => {
    let keyboards = []
    let userData;
    try {
        const user = await prisma.user.findMany({
            include: {
                countdowns: {
                    orderBy: {
                        date: 'asc',
                    },
                }
            },
            where: { chatId: ctx.chat.id.toString() },
            orderBy: {
                date: 'asc',
            },
        })

        userData = user[0].countdowns

    } catch (e) {
        console.log(e.message)
        return;
    }
    userData.forEach((countdown, i) => {
        keyboards.push([countdown.name + ", " + countdown.date])
    })

    ctx.reply(
        "Which countdown do you want to edit?",
        Markup.keyboard(keyboards).resize()
    );
    step = "Choose countdown"
});

bot.hears(/Remove countdown/, async (ctx) => {
    let keyboards = []
    let userData;
    try {
        const user = await prisma.user.findMany({
            include: {
                countdowns: {
                    orderBy: {
                        date: 'asc',
                    },
                }
            },
            where: { chatId: ctx.chat.id.toString() },
            orderBy: {
                date: 'asc',
            },
        })

        userData = user[0].countdowns

    } catch (e) {
        console.log(e.message)
        return;
    }
    userData.forEach((countdown, i) => {
        keyboards.push([countdown.name + ", " + countdown.date])
    })

    ctx.reply(
        "Which countdown do you want to delete?",
        Markup.keyboard(keyboards).resize()
    );
    step = "Remove countdown"
});

bot.hears(/Enable daily reminders/, (ctx) => {
    ctx.reply(fmt(bold("Hello"), italic("there")));
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

bot.on(message("text"), async (ctx) => {

    if (step === "Add Name") {
        ctdn.name = ctx.message.text;
        step = "Add Date";

        ctx.reply(
            `Now send me the date (YYYY-MM-DD), e.g. ${new Date().toISOString().slice(0, 10)}`
        );
        return;
    }

    if (step === "Add Date") {
        const dateStr = ctx.message.text;
        const target = Date.parse(dateStr);
        if (isNaN(target)) {
            ctx.reply("❌ Invalid date. Use YYYY-MM-DD");
            return;
        }
        ctdn.date = dateStr;

        const delta = target - Date.now();
        const MS_PER_DAY = 86400000;
        try {

            await prisma.countdowns.create({
                data: {
                    name: ctdn.name,
                    date: dateStr,
                    user: {
                        connect: { chatId: ctx.chat.id.toString() }
                    }
                }
            })
        } catch (e) {
            console.log(e.message)
            return;
        }
        let result;
        if (delta > 0) {
            result = `${Math.ceil(delta / MS_PER_DAY)} days left`;
        } else if (delta < -MS_PER_DAY) {
            result = `${Math.floor(Math.abs(delta) / MS_PER_DAY)} days ago`;
        } else {
            result = "IT'S TODAY!";
        }

        ctx.reply(
            `${ctdn.name}\n(${dateStr})\n${result}`
        );

        // cleanup
        step = "";
        ctdn = {};
        return;
    }

    if (step === "Choose countdown") {
        selectedCountdown = ctx.message.text.split(",")[0];
        ctx.reply(
            "What do you want to change?",
            Markup.keyboard([
                ["Edit name"],
                ["Edit date"],
                ["🔙 Cancel"]
            ]).resize()
        );
        step = "Edit name or date"
        return;
    }

    if (step === "Edit name or date") {
        const userChoice = ctx.message.text;
        if (userChoice === "Edit name") {
            ctx.reply("What do you want to change the name to?")
            step = "Set name"
            return;
        }
        else if (userChoice === "Edit date") {
            ctx.reply(`What do you want to change the date to? Send send me the date (YYYY-MM-DD), e.g. ${new Date().toISOString().slice(0, 10)}`)
            step = "Set date"
            return;
        }
        return;

    }

    if (step === "Set name") {
        const newName = ctx.message.text;
        try {
            await prisma.countdowns.updateMany({
                where: {
                    name: selectedCountdown,
                    user: {
                        chatId: ctx.chat.id.toString(),
                    },
                },
                data: {
                    name: newName,
                },
            })

        } catch (e) {
            console.log(e.message)
        }
        let updatedCountdown;
        try {
            updatedCountdown = await prisma.countdowns.findMany({
                where: {
                    name: newName,
                    user: {
                        chatId: ctx.chat.id.toString()
                    }
                }
            })
        } catch (e) {
            console.log(e.message)
        }

        const target = Date.parse(updatedCountdown[0].date);
        const delta = target - Date.now();
        const MS_PER_DAY = 86400000;

        let result;
        if (delta > 0) {
            result = `${Math.ceil(delta / MS_PER_DAY)} days left`;
        } else if (delta < -MS_PER_DAY) {
            result = `${Math.floor(Math.abs(delta) / MS_PER_DAY)} days ago`;
        } else {
            result = "IT'S TODAY!";
        }
        ctx.reply(
            `${newName}\n(${updatedCountdown[0].date})\n${result}`,
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
        step = ""
        selectedCountdown = ""
        ctdn = {}
        return;
    }

    if (step === "Set date") {
        const newDate = ctx.message.text;
        const target = Date.parse(newDate);
        if (isNaN(target)) {
            ctx.reply("❌ Invalid date. Use YYYY-MM-DD");
            return;
        }
        try {
            await prisma.countdowns.updateMany({
                where: {
                    name: selectedCountdown,
                    user: {
                        chatId: ctx.chat.id.toString(),
                    },
                },
                data: {
                    date: newDate,
                },
            })
        } catch (e) {
            console.log(e.message)
            return;
        }

        const delta = target - Date.now();
        const MS_PER_DAY = 86400000;

        let result;
        if (delta > 0) {
            result = `${Math.ceil(delta / MS_PER_DAY)} days left`;
        } else if (delta < -MS_PER_DAY) {
            result = `${Math.floor(Math.abs(delta) / MS_PER_DAY)} days ago`;
        } else {
            result = "IT'S TODAY!";
        }
        ctx.reply(
            `${selectedCountdown}\n(${newDate})\n${result}`,
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

        step = ""
        selectedCountdown = ""
        ctdn = {}
        return;
    }

    if (step === "Remove countdown") {
        selectedCountdown = ctx.message.text.split(",")[0]
        try {
            await prisma.countdowns.deleteMany({
                where: {
                    name: selectedCountdown,
                    user: {
                        chatId: ctx.chat.id.toString()
                    }
                }
            })
        } catch (e) {
            console.log(e.message)
            return;
        }
        ctx.reply(
            "Countdown was deleted",
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

        step = ""
        selectedCountdown = ""
        ctdn = {}
        return;
    }
});


bot.launch();