from django.db import models
from samplesbrowser.models import Evidence
from django.contrib.auth.models import User

class Note(models.Model):
    mutation = models.ForeignKey(Evidence, on_delete=models.SET_NULL, null=True,related_name='ev_notes')
    last_edit = models.DateTimeField()
    note = models.CharField(max_length=500, null=True, blank=True)
    prediction = models.CharField(max_length=10)
    author= models.ForeignKey(User,on_delete=models.SET_NULL,null=True,related_name='usr_notes')
    is_del = models.BooleanField(default=False)

