import { Controller, Get, Header, Param, ParseUUIDPipe, Res, StreamableFile } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Permission } from '../../common/permissions/permissions.config';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
@Controller('movements')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /**
   * The original served this by UUID with no check at all, so anyone holding a
   * link could read anyone's document. It is behind the same lookup as the
   * movement now, which answers 404 for another organization's.
   */
  @Get(':id/pdf')
  @RequirePermissions(Permission.MovementReadAll)
  @Header('Content-Type', 'application/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Download the movement as a PDF' })
  @ApiOkResponse({ description: 'The document', schema: { type: 'string', format: 'binary' } })
  @ApiNotFoundResponse({ description: 'No such movement in this organization' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { filename, content } = await this.documents.movementPdf(id);

    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return new StreamableFile(content);
  }
}
