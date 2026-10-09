import os
import re
import tempfile
import unittest
import sys
from pathlib import Path

os.environ.setdefault('JWT_SECRET_KEY', 'local-test-secret-that-is-at-least-32-bytes-long')
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app, db


class ApiSecurityTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.app = create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': f"sqlite:///{self.tempdir.name}/test.db", 'JWT_SECRET_KEY': 'unit-test-secret-that-is-at-least-32-bytes-long'})
        self.client = self.app.test_client()
        with self.app.app_context():
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
            db.engine.dispose()
        self.tempdir.cleanup()

    def register(self, name, email):
        response = self.client.post('/api/auth/register', json={'name': name, 'email': email, 'password': 'goodpassword123'})
        self.assertEqual(response.status_code, 201, response.get_json())
        return response.get_json()['token']

    def auth(self, token):
        return {'Authorization': f'Bearer {token}'}

    def test_auth_validation_and_duplicate_email(self):
        self.assertEqual(self.client.get('/api/notes').status_code, 401)
        self.assertEqual(self.client.post('/api/auth/register', json={'name': 'A', 'email': 'bad', 'password': '123'}).status_code, 400)
        self.register('Ada Student', 'ada@example.com')
        self.assertEqual(self.client.post('/api/auth/register', json={'name': 'Ada Student', 'email': 'ADA@example.com', 'password': 'goodpassword123'}).status_code, 409)
        login = self.client.post('/api/auth/login', json={'email': 'ada@example.com', 'password': 'wrongpassword123'})
        self.assertEqual(login.status_code, 401)

    def test_frontend_and_deep_links_serve_the_single_page_app(self):
        home = self.client.get('/')
        self.assertEqual(home.status_code, 200)
        script = re.search(r'src="([^"]+\.js)"', home.get_data(as_text=True))
        self.assertIsNotNone(script)
        script_response = self.client.get(script.group(1))
        self.assertEqual(script_response.status_code, 200)
        script_response.close()
        home.close()
        shared = self.client.get('/shared/example-token')
        self.assertEqual(shared.status_code, 200)
        shared.close()

    def test_user_cannot_access_another_users_notes_or_folders(self):
        ada = self.register('Ada Student', 'ada@example.com')
        ben = self.register('Ben Student', 'ben@example.org')
        folder = self.client.post('/api/folders', headers=self.auth(ada), json={'name': 'Biology'}).get_json()['folder']
        created = self.client.post('/api/notes', headers=self.auth(ada), json={'title': 'Cell notes', 'content': 'Mitochondria make ATP.', 'folder_id': folder['id']})
        note = created.get_json()['note']
        self.assertEqual(created.status_code, 201)
        self.assertEqual(self.client.get(f"/api/notes/{note['id']}", headers=self.auth(ben)).status_code, 404)
        self.assertEqual(self.client.patch(f"/api/notes/{note['id']}", headers=self.auth(ben), json={'title': 'stolen'}).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/notes/{note['id']}", headers=self.auth(ben)).status_code, 404)
        self.assertEqual(self.client.get('/api/notes', headers=self.auth(ben)).get_json()['notes'], [])
        self.assertEqual(self.client.patch(f"/api/folders/{folder['id']}", headers=self.auth(ben), json={'name': 'stolen'}).status_code, 404)
        foreign_folder_note = self.client.post('/api/notes', headers=self.auth(ben), json={'title': 'Wrong folder', 'content': 'This folder belongs to another user.', 'folder_id': folder['id']})
        self.assertEqual(foreign_folder_note.status_code, 404)

    def test_note_crud_search_tags_and_share_revocation(self):
        token = self.register('Ada Student', 'ada@example.com')
        response = self.client.post('/api/notes', headers=self.auth(token), json={'title': 'Chemistry', 'content': 'Atoms and bonds', 'tags': ['class notes']})
        note = response.get_json()['note']
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(self.client.get('/api/notes?q=atoms', headers=self.auth(token)).get_json()['notes']), 1)
        self.assertEqual(self.client.patch(f"/api/notes/{note['id']}", headers=self.auth(token), json={'favorite': True}).get_json()['note']['favorite'], True)
        url = self.client.post(f"/api/notes/{note['id']}/share", headers=self.auth(token), json={}).get_json()['url']
        share_token = url.rsplit('/', 1)[-1]
        self.assertEqual(self.client.get(f'/api/shared/{share_token}').status_code, 200)
        self.client.delete(f"/api/notes/{note['id']}/share", headers=self.auth(token))
        self.assertEqual(self.client.get(f'/api/shared/{share_token}').status_code, 404)
        self.assertEqual(self.client.delete(f"/api/notes/{note['id']}", headers=self.auth(token)).status_code, 200)

    def test_ai_endpoint_fails_clearly_without_provider_key(self):
        token = self.register('Ada Student', 'ada@example.com')
        note = self.client.post('/api/notes', headers=self.auth(token), json={'title': 'Class', 'content': 'A substantial note.'}).get_json()['note']
        old = os.environ.pop('OPENAI_API_KEY', None)
        try:
            response = self.client.post(f"/api/notes/{note['id']}/ai/summary", headers=self.auth(token), json={})
            self.assertEqual(response.status_code, 503)
            self.assertIn('OPENAI_API_KEY', response.get_json()['error'])
        finally:
            if old is not None:
                os.environ['OPENAI_API_KEY'] = old

    def test_duplicate_detection_is_owner_scoped_and_chat_reports_missing_key(self):
        ada = self.register('Ada Student', 'ada@example.com')
        ben = self.register('Ben Student', 'ben@example.org')
        first = self.client.post('/api/notes', headers=self.auth(ada), json={'title': 'Cellular respiration', 'content': 'Cellular respiration converts glucose and oxygen into energy, carbon dioxide, and water for cells.'}).get_json()['note']
        self.client.post('/api/notes', headers=self.auth(ada), json={'title': 'Cellular respiration', 'content': 'Cellular respiration converts glucose and oxygen into energy, carbon dioxide, and water for cells.'})
        self.client.post('/api/notes', headers=self.auth(ben), json={'title': 'Cellular respiration', 'content': 'Cellular respiration converts glucose and oxygen into energy, carbon dioxide, and water for cells.'})
        matches = self.client.get(f"/api/notes/{first['id']}/duplicates", headers=self.auth(ada)).get_json()['matches']
        self.assertEqual(len(matches), 1)
        old = os.environ.pop('OPENAI_API_KEY', None)
        try:
            response = self.client.post('/api/chat', headers=self.auth(ada), json={'question': 'What is cellular respiration?'})
            self.assertEqual(response.status_code, 503)
        finally:
            if old is not None:
                os.environ['OPENAI_API_KEY'] = old


if __name__ == '__main__':
    unittest.main()
