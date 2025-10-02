import threading
import time
from datetime import datetime
from models import Job, Execution, db
import subprocess

def execute_job(job):
    # Lógica de execução de jobs, dependências, retries etc.
    exec_entry = Execution(job_id=job.id, status='running', start_time=datetime.utcnow())
    db.session.add(exec_entry)
    db.session.commit()

    try:
        # Executa o comando do job
        subprocess.run(job.command, shell=True, check=True, timeout=job.timeout*60)
        exec_entry.status = 'success'
        exec_entry.logs = f'Job {job.name} executado com sucesso!'
    except subprocess.CalledProcessError as e:
        exec_entry.status = 'failed'
        exec_entry.logs = str(e)
    except subprocess.TimeoutExpired:
        exec_entry.status = 'failed'
        exec_entry.logs = 'Timeout expirado'
    
    exec_entry.end_time = datetime.utcnow()
    db.session.commit()

def scheduler_loop():
    while True:
        # Aqui você verifica todos os jobs ativos e horários para executar
        time.sleep(5)

def start_scheduler(app, db):
    thread = threading.Thread(target=scheduler_loop, daemon=True)
    thread.start()
