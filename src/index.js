require('dotenv/config');
const MailComposer = require('nodemailer/lib/mail-composer');
const AWS = require('aws-sdk');
const express = require('express');
const { spawn } = require('child_process');
const { readdirSync, rmSync } = require('fs');
const path = require('path');

const bat = require.resolve(process.env.BACKUP_SCRIPT);

const app = express();

let date = new Date().toLocaleDateString()

var regex = new RegExp('/', 'g');

date = date.replace(regex, '_')

const proc = process.env.OSS === 'win'? 
 spawn(bat, [date]) : process.env.OS ==='lin'? 
 spawn(bat, [date]): null

const sesConfig = {
  apiVersion: '2019-09-27',
  accessKeyId: process.env.AWS_SES_KEY_ID,
  secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
  region: process.env.AWS_SES_REGION,
};

const main = async ()=>{

    let dir
    let file
    try {
        dir = readdirSync(path.resolve(__dirname, '../backups/'));
        file =  path.resolve('../backups/'+ dir[1])
      } catch (err) {
        console.error(err);
        return
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
      attachments: { filename:message.attachments.name, path: message.attachments.data, encoding: 'base64' }
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
      }
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
    try {
        dir = rmSync(file);
      } catch (err) {
        console.error(err);
        return
      }
  } catch (err) {
    console.log(err.message);
  }
}

const backup = () => {
    try{
    console.log('entrei')
    proc.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });
  
    proc.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
    });
  
    proc.on('exit', (code) => {
      console.log(`child process exited with code ${code}`);
    });
    }catch(err){
    console.log(err)
    }
    console.log('running on port', process.env.APP_PORT);
  
  }

app.listen(process.env.APP_PORT, async()=>{
    const promise = new Promise((resolve, reject)=>{
        try{
            resolve(backup())
        }catch(err){
            console.log(err)
            return
        }
    })
    await promise.then(()=>console.log('promise realizada')).catch(err=>console.log(err))
    main()
}
  
  

);
