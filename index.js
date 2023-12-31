const { get_mailbox, get_mail, get_parent_mail, modify, get_draft, get_new_reply, delete_draft, send_mail } = require('./Components/mails');
const { execute, executemany } = require('./Components/postgres_connect');
const cookieParser = require('cookie-parser');
const sessions = require('express-session');
const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const saltRounds = 10

const app = express()

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "/build")));
app.use(cookieParser());

app.use(sessions({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 *24 },
    resave: false,
}));

app.get('/api/v1/logout', async (req, res) => {
    req.session.destroy()
    res.end()
})

app.post('/api/v1/login', async (req, res) => {
    id = req.body.user_id
    pwd = req.body.password
    execute(["SELECT hashed_pwd FROM mail_user where id = $1 and num_mails != '-1'"],[[id]])
    .then(output => {
        if (output[1].length == 0) {
            if (output[0][0].status == "0") res.send([{"status":"id_not_found"}])
            else res.send(output[0])
        }
        else {
            bcrypt.compare(pwd, output[1][0].hashed_pwd,
                async (err,match)=>{
                    if (err) {
                        res.send([{"status":"err_password_hash_error"}])
                    }
                    else {
                        if (match) {
                            req.session.user_id = id
                            req.session.save()
                            res.send(output[0])
                        }
                        else {
                            res.send([{"status":"wrong_pwd"}])
                        }
                    }
                }
            )
        }
    })
    .catch(err => {
        res.send([{"status":"err_run_query"}])
    })
})

app.post('/api/v1/signup',
    async (req,res)=>{
        id = req.body.user_id
        pwd = req.body.password
        full_name = req.body.name
        execute(["SELECT * FROM mail_user where id = $1"],[[id]])
        .then(output => {
            if (output[1].length == 0) {
                if (output[0][0].status == "0"){
                    bcrypt.hash(pwd, saltRounds,
                        (err,hashed_pwd)=>{
                            if (err) {
                                res.send([{"status":"err_password_hash_error"}])
                            }
                            else {
                                execute(["insert into mail_user values ($1,$2,$3)"],[[id,hashed_pwd,full_name]])
                                .then(result => {
                                    req.session.user_id = id
                                    req.session.save()
                                    res.send(output[0])
                                })
                                .catch(err => {
                                    res.send([{"status":"err_run_query"}])
                                })
                            }
                        }
                    )
                }
                else res.send(output[0])
            }
            else res.send([{"status":"id_already_exists"}])
        })
        .catch(err => {
            res.send([{"status":"err_run_query"}])
        })
    }
)

app.get('/api/v1/check_login',
    async (req,res)=>{
        if (req.session.user_id) res.send([[{"status":"0"}]])
        else res.send([[{ "status":"not_logged_in"}]])
    }
)

app.get('/api/v1/mail/:box',
    async (req,res)=>{
        box = req.params.box
        id = req.session.user_id
        if (id){
            get_mailbox(id,box)
            .then(output => {
                res.send(output)
            })
            .catch(err => {
                res.send([[{"status":"err_fetching_mailbox"}]])
            })
        }
        else res.send([[{ "status":"not_logged_in"}]])
    }
)

app.post('/api/v1/get_mail/:box',
    async (req,res)=>{
        id = req.session.user_id
        box = req.params.box
        if (id){
            sender_id = req.body.sender_id
            mail_num = req.body.mail_num
            get_mail(id,sender_id,mail_num,box)
            .then(output => {
                res.send(output)
            })
            .catch(err => {
                console.log(err)
                res.send([[{"status":"err_fetching_mail"}]])
            })
        }
        else res.send([[{ "status":"not_logged_in"}]])
    }
)

app.post('/api/v1/get_parent_mail',
    async (req,res)=>{
        id = req.session.user_id
        box = req.params.box
        if (id){
            sender_id = req.body.sender_id
            mail_num = req.body.mail_num
            get_parent_mail(sender_id,mail_num)
            .then(output => {
                res.send(output)
            })
            .catch(err => {
                res.send([[{"status":"err_fetching_mail"}]])
            })
        }
        else res.send([[{ "status":"not_logged_in"}]])
    }
)

app.get('/api/v1/compose/:num/:p_id/:p_mn',
    async (req,res)=>{
        id = req.session.user_id
        num = req.params.num
        p_id = req.params.p_id
        p_mn = req.params.p_mn
        if (id){
            console.log("Composing mail",num,p_id,p_mn)
            if (num === "0"){
                get_new_reply(id,p_id,p_mn)
                .then(output => {
                    res.send(output)
                })
                .catch(err => {
                    res.send([[{"status":"err_fetching_new_reply"}]])
                })
            }
            else{
                get_draft(id,num)
                .then(output => {
                    res.send(output)
                })
                .catch(err => {
                    res.send([[{"status":"err_fetching_draft"}]])
                })
            }
        }
        else res.send([[{ "status":"not_logged_in"}]])
    }
)

app.post('/api/v1/check_ids/',
    async (req,res)=>{
        ids_list = req.body.ids_list
        params = []
        for (i in ids_list){
            params.push([ids_list[i]])
        }
        executemany("SELECT * FROM mail_user where id = $1",params)
        .then(output => {
            if (output[0][0].status == "0"){
                for (i=1;i<output.length;i++){
                    if (output[i].length == 0) {
                        res.send([[{"status":params[i-1][0]}]])
                        return
                    }
                }
                res.send([[{"status":"0"}]])
            }
            else res.send(output)
        })
    }
)

app.post('/api/v1/send_mail/:num',
    async (req,res)=>{
        console.log("send_mail API called",req.body.send_time)
        num = req.params.num
        id = req.session.user_id
        to_recipients = req.body.to_recipients
        cc_recipients = req.body.cc_recipients
        subject = req.body.subject
        content = req.body.content
        is_draft = req.body.is_draft
        is_scheduled = req.body.is_scheduled
        send_time = req.body.send_time
        p_id = req.body.p_id
        p_mn = req.body.p_mn
        att = req.body.att
        if (id){
            if (num != 0){
                delete_draft(id,num)
                .then(output => {
                    console.log("deleted old draft")
                })
                .catch(err => {
                    console.log("error deleting draft")
                    res.send([[{"status":"err_editing_draft"}]])
                })
            }
            send_mail(id,subject,content,to_recipients,cc_recipients,is_draft,is_scheduled,send_time,p_id,p_mn,att)
            .then(output => {
                console.log("mail sent")
                res.send(output)
            })
            .catch(err => {
                res.send([[{"status":"err_sending_mail"}]])
            })
        }
        else res.send([[{ "status":"not_logged_in"}]])
    }
)

app.post('/api/v1/modify',
    async (req,res)=>{
        id = req.session.user_id
        if (id){
            modify(id, req.body.s_id, req.body.mn, req.body.mod)
            .then(output => {
                res.send(output)
            })
            .catch(err => {
                console.log(err)
                res.send([[{"status":"err_modifying_mail"}]])
            })
        }
        else res.send([[{ "status":"not_logged_in"}]])
    }
)

app.post('/api/v1/new_mailing_list',
    async (req,res)=>{
        id = req.session.user_id
        list_id = req.body.list_id
        if (id){
            queries = ["INSERT into mail_user values ($1,$2,$3);"]
            params = [[list_id,"0","Mailing list"]]
            execute(queries,params)
            .then(output => {
                res.send(output)
            })
        }
        else res.send([[{ "status":"not_logged_in"}]])
    }
)

app.post('/api/v1/add_to_mailing_list',
    async (req,res)=>{
        id = req.session.user_id
        if (id){
            queries = ["INSERT INTO mailing_list VALUES ($1, $2);"]
            params = [[req.body.user_id, req.body.list_id]]
            execute(queries,params)
            .then(output => {
                res.send(output)
            })
        }
        else res.send([[{ "status":"not_logged_in"}]])
    }
)

app.get("*", (req, res) => { res.sendFile(path.join(__dirname, "./build/index.html"))});

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});