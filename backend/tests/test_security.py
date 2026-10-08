"""Security helper and configuration checks without database access."""
import secrets
import unittest

from pydantic import ValidationError

from app.core.config import Settings
from app.core.security import (
    create_access_token, decode_access_token, hash_password, verify_password,
)
from app.schemas.auth import RegisterRequest


class SecurityTests(unittest.TestCase):
    def test_password_boundaries_and_unmodified_whitespace(self):
        for size in (8, 128):
            password = ' ' + 'x' * (size - 2) + ' '
            data = RegisterRequest(email='boundary@example.com', password=password)
            self.assertTrue(data.password == password)
            encoded = hash_password(data.password)
            self.assertTrue(encoded.startswith('$argon2id$'))
            self.assertTrue(verify_password(password, encoded))
            self.assertFalse(verify_password(password.strip(), encoded))
        for size in (7, 129):
            with self.assertRaises(ValidationError):
                RegisterRequest(email='boundary@example.com', password='x' * size)

    def test_hash_salts_and_invalid_hashes(self):
        password = secrets.token_urlsafe(24)
        first = hash_password(password)
        second = hash_password(password)
        self.assertTrue(first != second)
        self.assertFalse(verify_password(password, 'invalid'))
        self.assertFalse(verify_password(password, '$argon2id$v=19$m=65536,t=3,p=4$invalid'))

    def test_jwt_round_trip(self):
        token, expiry = create_access_token(42)
        self.assertEqual(decode_access_token(token), 42)
        self.assertGreater(expiry, 0)

    def test_configuration_rejects_weak_keys_and_unsafe_algorithms(self):
        base = {'_env_file': None, 'database_url': 'postgresql://unused',
                'jwt_secret_key': secrets.token_urlsafe(48)}
        for changes in ({'jwt_secret_key': ''}, {'jwt_secret_key': 'short'},
                        {'jwt_algorithm': 'none'}, {'access_token_expire_minutes': 0}):
            with self.assertRaises(ValidationError):
                Settings(**{**base, **changes})


if __name__ == '__main__':
    unittest.main()
