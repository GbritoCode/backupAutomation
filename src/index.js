require('dotenv/config');
const MailComposer = require('nodemailer/lib/mail-composer');
const AWS = require('aws-sdk');
const express = require('express');
const { spawn } = require('child_process');

const bat = require.resolve('../../backups/backupScript.bat');

const app = express();

const proc = spawn(bat);

const sesConfig = {
  apiVersion: '2019-09-27',
  accessKeyId: process.env.AWS_SES_KEY_ID,
  secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
  region: process.env.AWS_SES_REGION,
};

const main = async ()=>{

  const generateRawMailData = (message) => {
    const mailOptions = {
      from: message.fromEmail,
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      subject: message.subject,
      text: message.bodyTxt,
      html: message.bodyHtml,
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
    console.log(response);
  } catch (err) {
    console.log(err.message);
  }


}



app.listen(process.env.APP_PORT, () => {
  proc.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  proc.stderr.on('data', (data) => {
    console.log(`stderr: ${data}`);
  });

  proc.on('exit', (code) => {
    console.log(`child process exited with code ${code}`);
  });

  console.log('running on port', process.env.APP_PORT);

  main()


});
