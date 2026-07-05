from locust import HttpUser, task, between

import random

STUDENT_USER_IDS = [157, 4220]  

MESSAGES = [

    "the AC is broken in lab 10",

    "lab 10 building C",

    "since last Monday",

    "التكييف مكسور في المعمل",

    "معمل عشرة",

    "my grades are wrong in Data Mining",

    "the internet is not working",

    "I was barred from the final exam",

    "درجاتي غلط في مادة تعدين البيانات",

    "الدكتور اداني ظلم في الامتحان",

]

class ChatUser(HttpUser):

    wait_time = between(5, 10)

    session_id = None

    user_id = None

    message_count = 0

    def on_start(self):

        self.user_id = random.choice(STUDENT_USER_IDS)

        r = self.client.post("/chat/session",

            json={"user_id": self.user_id}, name="start_session")

        if r.status_code == 200:

            self.session_id = r.json().get("session_id")

            self.message_count = 0

    @task

    def send_message(self):

        if not self.session_id:

            return

        if self.message_count >= 5:

            self.on_start()

            return

        r = self.client.post("/chat/message",

            json={

                "session_id": self.session_id,

                "user_id": self.user_id,

                "message": random.choice(MESSAGES),

            },

            name="send_message", timeout=120)

        if r.status_code == 404:

            self.session_id = None

        else:

            self.message_count += 1
