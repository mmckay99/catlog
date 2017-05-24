from flask import Flask
from flask import render_template

app = Flask(__name__)

@app.route('/')
def index():
    return redirect(url_for('new'))

@app.route('/new')
def new_catlog_page():
    # Generate a new catlog key.

    return render_template('catlog.html')

@app.route('/<string:catlog_key>')
def show_catlog(catlog_key):
    return render_template('catlog.html')