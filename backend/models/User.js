const db = require('../config/database')
const bcrypt = require('bcryptjs');

class User{

    static async create({username, email, password, displayName}){
        const passwordHash = await bcrypt.hash(password, 10);

        const query = `
        INSERT INTO users (username, email, password_hash, display_name)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, email, display_name, created_at
        `

        const result = await db.query(query, [username, email, passwordHash, displayName]);
        return result.rows[0];
    }

    //find user by email
    static async findByEmail(email){
        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await db.query(query, [email]);
        return result.rows[0];
    }

    // Find user by username
    static async findByUsername(username) {
    const query = 'SELECT * FROM users WHERE username = $1';
    const result = await db.query(query, [username]);
    return result.rows[0];
    }

    //find user by id
    static async findById(id){
        const query = 'SELECT id, username, email, display_name, bio, created_at FROM users WHERE id = $1';
        const result = await db.query(query, [id]);
        return result.rows[0];
    }

    //verify password
    static async verifyPassword(plainPassword, hashedPassword){
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
}

module.exports = User;