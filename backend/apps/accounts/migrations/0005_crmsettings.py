from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_userprofile_photo_label_url"),
    ]

    operations = [
        migrations.CreateModel(
            name="CRMSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.CharField(default="global", max_length=64, unique=True)),
                ("bureau", models.JSONField(blank=True, default=dict)),
                ("integrations", models.JSONField(blank=True, default=dict)),
                ("notifications", models.JSONField(blank=True, default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "CRM settings",
                "verbose_name_plural": "CRM settings",
            },
        ),
    ]
