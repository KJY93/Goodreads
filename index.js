// Loading libraries
const express = require('express')
const handlebars = require('express-handlebars')
const mysql = require('mysql2/promise')
const fetch = require('node-fetch')
const withQuery = require('with-query').default

// Configuring port
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

// Creating database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'goodreads',
    password: process.env.DB_PASSWORD,
    user: process.env.DB_USER,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 4,
    timezone: '+08:00'
})

const startApp = async (app, pool) => {
    try {
        // Acquiring connection from connection pool
        const conn = await pool.getConnection()
        console.info('Pinging database...')
        await conn.ping()

        // Releasing the connection
        conn.release()

        // Starting up the server
        app.listen(
            PORT, 
            () => {
                console.info(`Application started on PORT ${PORT} at ${new Date()}`)
            }
        )
    }
    catch (err) {
        console.error('Cannot ping database: ', err)
    }
}

// Creating an instance of express application
const app = express()

// Loading static files
app.use(
    express.static(__dirname + '/static')
)

// Configuring handlebars 
app.engine('hbs', handlebars({
    defaultLayout: 'default.hbs'
}))
app.set('view engine', 'hbs')

startApp(app, pool)
