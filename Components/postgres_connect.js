const pg = require("pg");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, "..", ".env") });
const client = new pg.Client(process.env.CONNECTION_STRING);

client.connect(err => {
    if(err) {
        console.log("Failed to connect to the database");
    } else {
        console.log("Successfully connected to the database");
    }
});

// client.query(`
//     create table mail_admin(
//         id varchar(25) not null,
//         hashed_pwd varchar(80) not null,
//         primary key(id)
//     );
// `);
// 
// 
// client.query(`
//     create table mail_user(
//         id varchar(25),
//         hashed_pwd varchar(80) not null,
//         name varchar(40) not null,
//         profile_pic varchar(30),
//         num_mails int not null default 0 check (num_mails >= 0),
//         -- number of mails sent by the user
//         primary key(id)
//     );
// `);
// 
// 
// client.query(`
//     create table mail(
//         sender_id varchar(25) not null,
//         mail_num int not null,
//         time timestamptz not null,
//         subject varchar(200),
//         content varchar(1000), ---------------------------- or text?
//         is_draft boolean not null default false,
//         starred boolean not null default false,
//         trashed boolean not null default false,
//         -- in trash of sender
//         deleted boolean not null default false,
//         -- deleted permanently
//         primary key(sender_id, mail_num),
//         foreign key(sender_id) references mail_user(id) on delete cascade
//     );
// `);
// 
// 
// client.query(`
//     create table recipient(
//         sender_id varchar(25) not null,
//         mail_num int not null,
//         id varchar(25) not null,
//         is_cc boolean not null default false,
//         read boolean not null default false,
//         starred boolean not null default false,
//         trashed boolean not null default false,
//         -- in trash of recipient
//         deleted boolean not null default false,
//         -- deleted permanently
//         primary key(sender_id, mail_num, id),
//         foreign key(sender_id, mail_num) references mail(sender_id, mail_num) on delete cascade,
//         foreign key(id) references mail_user(id) on delete cascade
//     );
// `);
// 
// 
// client.query(`
//     create table mailing_list(
//         id varchar(25) not null,
//         list_id varchar(25) not null,
//         primary key(id, list_id),
//         foreign key(id) references mail_user(id) on delete cascade,
//         foreign key(list_id) references mail_user(id) on delete cascade
//     );
// `);
// 
// 
// client.query(`
//     create table reply(
//         id varchar(25) not null,
//         mail_num int not null,
//         p_id varchar(25) not null,
//         p_mail_num int not null,
//         primary key(id, mail_num),
//         foreign key(id, mail_num) references mail(sender_id, mail_num) on delete cascade,
//         foreign key(p_id, p_mail_num) references mail(sender_id, mail_num) on delete cascade
//     );
// `);
// 
// 
// client.query(`
//     create table attachment(
//         sender_id varchar(25) not null,
//         mail_num int not null,
//         att_num int not null check (att_num >= 0),
//         file_name varchar(100) not null,
//         file_data text,
//         primary key(sender_id, mail_num, att_num),
//         foreign key(sender_id, mail_num) references mail(sender_id, mail_num) on delete cascade
//     );
// `);
// 
// execute each query in queries with corresponding params tuple in params
async function execute (queries, params){
    output = [[{"status":"0"}]]
    for (let i=0;i<queries.length;i++){
        try {
            result = await client.query(queries[i],params[i])
            output = output.concat([result.rows])
        } catch (error) {
            console.log("Postgres query ",i+1," failed:",error)
            return [[{"status":"err_postgres_query"}]]
        }
    }
    return output
}

// same functionality as execute but if output is inconsistent, it executes again
async function consistent_execute (queries, params){
    output = await execute(queries,params)
    if (output.length !== 1+queries.length){
        output = await consistent_execute(queries,params)
    }
    return output
}

// execute a single query with each tuple in params
async function executemany (query, params){
    output = [[{"status":"0"}]]
    for (let i=0;i<params.length;i++){
        try {
            result = await client.query(query,params[i])
            output = output.concat([result.rows])
        } catch (error) {
            console.log("Postgres query ",i," failed:",error)
            return [[{"status":"err_postgres_query"}]]
        }
    }
    return output
}

module.exports = {
    execute,
    consistent_execute,
    executemany
}