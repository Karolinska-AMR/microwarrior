from django.db import models
from django.contrib.auth.models import User


class Task(models.Model):
    task_id = models.CharField(max_length=50)
    ticket = models.CharField(max_length=20)
    name = models.CharField(max_length=20)
    submission_timestamp = models.DateTimeField(auto_now=True)
    completion_timestamp = models.DateTimeField(null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    status = models.IntegerField()
    logs = models.TextField()
    samples_count = models.IntegerField(default=0)
