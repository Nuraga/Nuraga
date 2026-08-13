import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { CreateParentAccountDto } from "./create-parent-account.dto";

// Same class-validator @IsOptional()-doesn't-exempt-"" gotcha as
// CreateStaffDto (see its spec) — email/phone default to the Parent row's
// existing contact fields when omitted (FamiliesService.provisionParentAccount),
// so an empty-string email from an untouched form field must validate clean.
describe("CreateParentAccountDto", () => {
  it("accepts an empty-string email", async () => {
    const dto = plainToInstance(CreateParentAccountDto, {
      password: "secret123",
      email: "",
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("still rejects a malformed non-empty email", async () => {
    const dto = plainToInstance(CreateParentAccountDto, {
      password: "secret123",
      email: "not-an-email",
    });

    const errors = await validate(dto);
    expect(errors.find((e) => e.property === "email")).toBeDefined();
  });
});
