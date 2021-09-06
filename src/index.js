const MailComposer = require('nodemailer/lib/mail-composer');
const AWS = require('aws-sdk');
const express = require('express');
const { spawnSync } = require('child_process');
const { readdirSync, rmSync } = require('fs');
const path = require('path');
const test = require('./test');

require('dotenv').config({ path: test.envPath });

const bat = require.resolve(process.env.BACKUP_SCRIPT);

const app = express();

let date = new Date().toLocaleDateString();

const regex = new RegExp('/', 'g');

date = date.replace(regex, '_');

let dir; let
  file;
const scriptName = process.env.OSS === 'win' ? '_backupScript.bat' : '_backupScript.sh';
const sesConfig = {
  apiVersion: '2019-09-27',
  accessKeyId: process.env.AWS_SES_KEY_ID,
  secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
  region: process.env.AWS_SES_REGION,
};

const main = async () => {
  try {
    dir = readdirSync(path.resolve(__dirname, '../backups/'));
    dir = dir.filter((arr) => arr !== scriptName);
    file = dir.filter((arr) => arr !== scriptName).map((arr) => ({
      name: `${arr}`,
      data: path.resolve(__dirname, `../backups/${arr}`),
    }));
  } catch (err) {
    throw new Error(err);
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
      attachments: message.attachments.map((f) => ({ filename: f.name, path: f.data, encoding: 'base64' })),
    };

    return new MailComposer(mailOptions).compile().build();
  };

  const exampleSendEmail = async () => {
    const message = {
      fromEmail: 'suporte@tovoit.com.br',
      to: process.env.TO_EMAILS,
      cc: [],
      bcc: [],
      subject: 'Alteração de senha',
      bodyTxt: '',
      bodyHtml: `Olá <strong>hjkh</strong> <br> Foi solicitado uma alteração de senha para o seu usuário no aplicativo Tovo,<br>
        caso essa alteração não tenha sido solicitada por você, altere sua senha e entre em contato com o admnistrador<br>
        segue sua nova senha, é aconselhável alterá-la ao fazer login no sistema.<br>
        <strong style="margin-left: 25%" > hjkhjk<strong>
        `,
      attachments: file,
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
      file.forEach((arr) => {
        rmSync(arr.data);
      });
    } catch (err) {
      throw new Error(err);
    }
    console.log(response);
  } catch (err) {
    throw new Error(err);
  }
};

const backup = async () => {
  const proc = spawnSync(bat, [date]);
  console.log('backup');
  if (parseInt(proc.status, 10) !== 0) {
    throw new Error(proc.stderr.toString('utf-8'));
  }
};

const killing = () => {
  const kill = spawnSync('fuser', ['-k', '-n', 'tcp', process.env.APP_PORT]);
  console.log('killing');
  if (kill.stderr.toString('utf-8')) {
    throw new Error(kill.stderr.toString('utf-8'));
  }
};

app.listen(process.env.APP_PORT, async () => {
  try {
    const promiseBackup = new Promise((resolve) => {
      try {
        resolve(backup());
      } catch (err) {
        throw new Error(err);
      }
    });
    await promiseBackup.then(
      () => console.log('promiseBackup realizada'),
    )
      .catch((err) => {
        throw new Error(err);
      });
    const promiseMain = new Promise((resolve) => {
      try {
        resolve(main());
      } catch (err) {
        throw new Error(err);
      }
    });

    await promiseMain.then(
      () => console.log('promiseMain realizada'),
    )
      .catch((err) => { throw new Error(err); });

    const promiseKill = new Promise((resolve) => {
      try {
        resolve(killing());
      } catch (err) {
        throw new Error(err);
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
