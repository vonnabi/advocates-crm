from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cases", "0007_case_authority_email"),
    ]

    operations = [
        migrations.AddField(
            model_name="case",
            name="procedural_actions",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
