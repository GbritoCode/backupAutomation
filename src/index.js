require('dotenv/config');
const MailComposer = require('nodemailer/lib/mail-composer');
const AWS = require('aws-sdk');
const express = require('express');
const { spawnSync } = require('child_process');
const { readdirSync, rmSync } = require('fs');
const path = require('path');

const scriptPath = path.resolve(__dirname, process.env.BACKUP_SCRIPT )

const bat = require.resolve(scriptPath);
const bat1 = require.resolve('../backups/_backupScript.sh');

const app = express();

let date = new Date().toLocaleDateString();

const regex = new RegExp('/', 'g');

date = date.replace(regex, '_');

let dir;
let file;

const sesConfig = {
  apiVersion: '2019-09-27',
  accessKeyId: process.env.AWS_SES_KEY_ID,
  secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
  region: process.env.AWS_SES_REGION,
};

const main = async () => {
  try {
    dir = readdirSync(path.resolve(__dirname, '../backups/'));
    console.log(dir);
    file = path.resolve(__dirname, `../backups/${dir[1]}`);
  } catch (err) {
    console.error(err);
    throw 'erro';
  }

  const generateRawMailData = (message) => {
    const mailOptions = {
      from: message.fromEmail,
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      subject: message.subject,
      text: message.bodyTxt,
      html: message.bodyHtml,
      attachments: { filename: message.attachments.name, path: message.attachments.data, encoding: 'base64' },
    };
    return new MailComposer(mailOptions).compile().build();
  };

  const exampleSendEmail = async () => {
    const message = {
      fromEmail: 'suporte@tovoit.com.br',
      to: ['gabrielcabeca26@gmail.com'],
      cc: [],
      bcc: [],
      subject: 'Alteração de senha',
      bodyTxt: '',
      bodyHtml: `Olá <strong>hjkh</strong> <br> Foi solicitado uma alteração de senha para o seu usuário no aplicativo Tovo,<br>
      caso essa alteração não tenha sido solicitada por você, altere sua senha e entre em contato com o admnistrador<br>
      segue sua nova senha, é aconselhável alterá-la ao fazer login no sistema.<br>
      <strong style="margin-left: 25%" > hjkhjk<strong>
      `,
      attachments: {
        name: `backup_${date}`,
        data: file,
      },
    };
    const ses = new AWS.SESV2(sesConfig);
    const params = {
      Content: { Raw: { Data: await generateRawMailData(message) } },
      Destination: {
        ToAddresses: message.to,
        BccAddresses: message.bcc,
        CcAddresses: message.cc,
      },
      FromEmailAddress: message.fromEmail,
      ReplyToAddresses: message.replyTo,
    };
    return ses.sendEmail(params).promise();
  };
  try {
    const response = await exampleSendEmail();
    try {
      rmSync(file);
    } catch (err) {
      console.error(err);
      throw new Error(err);
    }
    console.log(response);
  } catch (err) {
    console.log(err.message);
    throw new Error(err);
  }
};

const backup = async () => {
  const proc = spawnSync(bat, [date]);
  console.log('--------------');
  console.log(proc.output.toString('utf-8'))
  console.log(proc.stdout.toString('utf-8'))
  console.log(proc.stderr.toString('utf-8'))
  console.log('--------------');
  if (parseInt(proc.status) !== 0) {
    throw new Error(proc.stderr.toString('utf-8'));
  }
};

const killing = () => {
  const kill = spawnSync('fuser', ['-k', '-n', 'tcp', process.env.APP_PORT]);
  console.log('killing');
  console.log('--------------');
  console.log(kill.stdout.toString('utf-8'));
  console.log(kill.stderr.toString('utf-8'));
  console.log(!!kill.stderr);
  console.log('--------------');
  if (kill.stderr.toString('utf-8')) {
    throw new Error(kill.stderr.toString('utf-8'));
  }
};

app.listen(process.env.APP_PORT, async () => {
  try {
    const promiseBackup = new Promise((resolve, reject) => {
      try {
        resolve(backup());
      } catch (err) {
        console.log('asdasd');
      }
    });
    await promiseBackup.then(
      () => console.log('promiseBackup realizada'),
    )
      .catch((err) => {
          console.log(err)
        throw new Error(err);
      });
    const promiseMain = new Promise((resolve, reject) => {
      try {
        resolve(main());
      } catch (err) {
        console.log(err);
        throw 'erro';
      }
    });

    await promiseMain.then(
      () => console.log('promiseMain realizada'),
    )
      .catch((err) => { throw new Error(err); });

    const promiseKill = new Promise((resolve, reject) => {
      try {
        resolve(killing());
      } catch (err) {
        console.log(err);
        throw 'erro';
      }
    });

    await promiseKill.then(
      () => console.log('promiseKill realizada'),
    )
      .catch((err) => {
        throw new Error(err);
      });
  } catch (err) {
    console.log(err);
  }
});
